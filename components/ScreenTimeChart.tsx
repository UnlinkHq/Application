import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Svg, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { DailyUsage } from '../utils/screenTimeData';

const MAX_BAR_HEIGHT = 160;

interface Props {
    selectedDate: number;
    selectedHour: number | null;
    selectedAppId: string | null;
    onSelectHour: (hour: number | null) => void;
    dailyData?: DailyUsage;
}

const ChartBar = memo(({ 
    item, 
    index, 
    barSlotWidth, 
    barWidth, 
    maxUsage, 
    selectedHour, 
    onSelect 
}: { 
    item: any; 
    index: number; 
    barSlotWidth: number; 
    barWidth: number; 
    maxUsage: number; 
    selectedHour: number | null; 
    onSelect: (h: number | null) => void;
}) => {
    const h = Math.max((item.value / maxUsage) * MAX_BAR_HEIGHT, item.value > 0 ? 4 : 0);
    const x = index * barSlotWidth + 1;
    const isSelected = selectedHour === item.hour;
    const intensity = item.value / maxUsage;
    
    let barColor = "#72fe88";
    if (intensity > 0.75) barColor = "#ffb4aa";
    else if (intensity > 0.3) barColor = "#ffab5e";
    
    let barOpacity = 1;
    if (item.value === 0) barOpacity = 0;
    else if (intensity < 0.2) barOpacity = 0.6;
    
    if (selectedHour !== null && !isSelected) {
        barOpacity *= 0.1;
    }

    return (
        <G key={item.hour}>
            <Rect
                x={x}
                y={0}
                width={barWidth}
                height={MAX_BAR_HEIGHT}
                fill="rgba(255,255,255,0.03)"
            />

            {isSelected && (
                <Rect 
                    x={x + barWidth/2 - 0.5} 
                    y={0} 
                    width={1} 
                    height={MAX_BAR_HEIGHT} 
                    fill="white" 
                    opacity={0.3} 
                />
            )}

            {item.value > 0 && (
                <Rect
                    x={x}
                    y={MAX_BAR_HEIGHT - h}
                    width={barWidth}
                    height={h}
                    fill={barColor}
                    opacity={barOpacity}
                    rx={0}
                />
            )}
            
            {/* Transparent touch target inside Svg to avoid overlay View issues on some android builds */}
            <Rect
                x={x}
                y={0}
                width={barSlotWidth}
                height={MAX_BAR_HEIGHT}
                fill="transparent"
                onPress={() => onSelect(isSelected ? null : item.hour)}
            />
        </G>
    );
});

export const ScreenTimeChart: React.FC<Props> = memo(({ selectedHour, selectedAppId, onSelectHour, dailyData }) => {
    const { width } = useWindowDimensions();
    const totalAvailableWidth = width - 48;

    const chartData = useMemo(() => {
        if (!dailyData) return null;
        const maxUsage = Math.max(...dailyData.hourly.map(h => {
             if (selectedAppId) {
                 const app = h.apps.find(a => a.id === selectedAppId);
                 return app ? app.duration : 0;
             }
             return h.totalDuration;
        }), 1);
        const items = dailyData.hourly.map(h => {
            let value = h.totalDuration;
            if (selectedAppId) {
                const app = h.apps.find(a => a.id === selectedAppId);
                value = app ? app.duration : 0;
            }
            return { hour: h.hour, value };
        });
        return { items, maxUsage };
    }, [dailyData, selectedAppId]);

    if (!dailyData || !chartData) return null;
    const { items, maxUsage } = chartData;
    const barSlotWidth = totalAvailableWidth / 24;
    const barWidth = barSlotWidth - 2;

    const format12H = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH} ${ampm}`;
    };

    return (
        <View className="w-full mt-8">
            <View className="flex-row items-center justify-between mb-8">
                <Text className="font-label text-xs uppercase tracking-[0.2em] text-[#919191]">
                    {selectedHour !== null ? `Intensity at ${format12H(selectedHour)}` : 'Hourly Intensity'}
                </Text>
                <View className="flex-1 h-[1px] bg-white/10 ml-4" />
            </View>

            <View style={{ height: MAX_BAR_HEIGHT + 40 }}>
                <Svg width={totalAvailableWidth} height={MAX_BAR_HEIGHT + 40}>
                    <Line x1="0" y1={MAX_BAR_HEIGHT} x2={totalAvailableWidth} y2={MAX_BAR_HEIGHT} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    
                    {items.map((item, index) => (
                        <ChartBar 
                            key={item.hour}
                            item={item}
                            index={index}
                            barSlotWidth={barSlotWidth}
                            barWidth={barWidth}
                            maxUsage={maxUsage}
                            selectedHour={selectedHour}
                            onSelect={onSelectHour}
                        />
                    ))}

                    {[0, 6, 12, 18, 23].map((h) => (
                        <SvgText
                            key={h}
                            x={h * barSlotWidth + barSlotWidth / 2}
                            y={MAX_BAR_HEIGHT + 25}
                            fill={selectedHour === h ? "white" : "#919191"}
                            fontSize="10"
                            fontWeight={selectedHour === h ? "bold" : "normal"}
                            textAnchor="middle"
                            letterSpacing="1"
                        >
                            {format12H(h)}
                        </SvgText>
                    ))}
                </Svg>
            </View>
        </View>
    );
});
