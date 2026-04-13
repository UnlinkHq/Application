import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelection } from '../../context/SelectionContext';
import { RuleCreationModal } from '../blocks/RuleCreationModal';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import { UsageBudgetConfig } from '../blocks/UsageBudgetConfig';
import { ScheduleBlockConfig } from '../blocks/ScheduleBlockConfig';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const GlobalModals = React.memo(() => {
    const {
        isSelectionVisible,
        closeSelection,
        activeConfigId,
        closeConfig,
        setActiveConfigId
    } = useSelection();

    const handleSelectRule = (id: string) => {
        // 1. Close the selection modal immediately
        closeSelection();

        // 2. Wait for the closing animation to finish before opening the config
        // This prevents bottom sheet animation clashes
        setTimeout(() => {
            setActiveConfigId(id as any);
        }, 300);
    };

    const renderActiveConfig = () => {
        switch (activeConfigId) {
            case 'usage':
                return <UsageBudgetConfig onBack={closeConfig} />;
            case 'schedule':
                return <ScheduleBlockConfig onBack={closeConfig} />;
            case 'block_now':
                return (
                    <View className="items-center justify-center py-10 ">
                        <View className="border-4 border-white mb-8">
                            <MaterialIcons name="bolt" size={48} color="white" />
                        </View>
                        <Text className="text-white font-headline font-black text-2xl uppercase tracking-tighter text-center mb-4">
                            CONFIRM_PROTOCOL_00
                        </Text>
                        <Text className="text-white/40 font-label text-xs uppercase tracking-[0.2em] text-center mb-10">
                            Immediate system-wide focus activation
                        </Text>
                        <TouchableOpacity
                            className="bg-white px-12 py-5 no-corners w-full"
                            onPress={closeConfig}
                        >
                            <Text className="text-black font-headline font-black text-lg uppercase text-center tracking-widest">ACTIVATE_NOW</Text>
                        </TouchableOpacity>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <RuleCreationModal
                visible={isSelectionVisible}
                onClose={closeSelection}
                onSelectRule={handleSelectRule}
            />

            <BottomSheetWrapper
                visible={activeConfigId !== null}
                onClose={closeConfig}
                onBack={closeConfig}
                snapPoints={['100%']}
                title={
                    activeConfigId === 'usage' ? 'SET TIME LIMITS' :
                        activeConfigId === 'schedule' ? 'SCHEDULE BLOCKING' :
                            activeConfigId === 'block_now' ? 'BLOCK NOW' :
                                undefined
                }
            >
                {renderActiveConfig()}
            </BottomSheetWrapper>
        </>
    );
});
