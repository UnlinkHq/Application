import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelection } from '../../context/SelectionContext';
import { RuleCreationModal } from '../blocks/RuleCreationModal';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import { UsageBudgetConfig } from '../blocks/UsageBudgetConfig';
import { ScheduleBlockConfig } from '../blocks/ScheduleBlockConfig';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { BlockNowConfig } from '../blocks/BlockNowConfig';

export const GlobalModals = memo(() => {
    const {
        isSelectionVisible,
        closeSelection,
        activeConfigId,
        closeConfig,
        setActiveConfigId
    } = useSelection();

    const handleSelectRule = (id: string) => {
        closeSelection();
        setActiveConfigId(id as any);
    };

    const renderActiveConfig = () => {
        switch (activeConfigId) {
            case 'usage':
                return <UsageBudgetConfig onBack={closeConfig} />;
            case 'schedule':
                return <ScheduleBlockConfig onBack={closeConfig} />;
            case 'block_now':
                return <BlockNowConfig onBack={closeConfig} />;
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
                snapPoints={['90%']}
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
