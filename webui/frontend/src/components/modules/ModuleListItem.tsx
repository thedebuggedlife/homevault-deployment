import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { ModuleContainerInfo } from '@/utils/docker';
import ContainerTable from '@/components/docker/ContainerTable';
import CoreModuleChip from './CoreModuleChip';
import { DockerContainerInfoChip } from './DockerContainerInfoChip';

interface ModuleListItemProps {
    moduleName: string;
    containerInfo: ModuleContainerInfo;
    isExpanded: boolean;
    onChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

export default function ModuleListItem({
    moduleName,
    containerInfo,
    isExpanded,
    onChange
}: ModuleListItemProps) {
    const isBaseModule = moduleName === 'base';

    return (
        <Accordion 
            expanded={isExpanded} 
            onChange={onChange}
            disabled={containerInfo.total === 0}
        >
            <AccordionSummary
                expandIcon={containerInfo.total > 0 ? <ExpandMore /> : null}
                aria-controls={`${moduleName}-content`}
                id={`${moduleName}-header`}
                sx={{
                    // '&:hover': {
                    //     backgroundColor: containerInfo.total > 0 ? 'action.hover' : 'transparent',
                    // },
                    cursor: containerInfo.total > 0 ? 'pointer' : 'default'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Typography component="span" sx={{ flexGrow: 1 }}>
                        {moduleName}
                    </Typography>
                    {isBaseModule && (
                        <CoreModuleChip tooltip="This module cannot be removed" />
                    )}
                    <DockerContainerInfoChip containerInfo={containerInfo} />
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                {containerInfo.containers.length > 0 ? (
                    <ContainerTable containers={containerInfo.containers} />
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        No containers found for this module
                    </Typography>
                )}
            </AccordionDetails>
        </Accordion>
    );
}