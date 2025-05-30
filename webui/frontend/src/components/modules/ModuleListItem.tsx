import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Box,
    Typography,
    Tooltip
} from '@mui/material';
import { ExpandMore, Lock as LockIcon } from '@mui/icons-material';
import { FaDocker as DockerIcon } from 'react-icons/fa';
import { ModuleContainerInfo } from '@/utils/docker';
import ContainerTable from '@/components/docker/ContainerTable';

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
                        <Tooltip title="This module cannot be removed">
                            <Chip
                                icon={<LockIcon />}
                                label="Core"
                                size="small"
                                variant="filled"
                                color="info"
                                sx={{
                                    '& .MuiChip-label': {
                                        paddingX: 1,
                                    },
                                    '& .MuiChip-icon': {
                                        marginLeft: 1,
                                        fontSize: '0.875rem'
                                    },
                                }}
                            />
                        </Tooltip>
                    )}
                    <Chip
                        icon={<DockerIcon />}
                        label={`${containerInfo.running}/${containerInfo.total} containers`}
                        color={containerInfo.running === containerInfo.total ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                        sx={{
                            '& .MuiChip-label': {
                                paddingX: 1,
                            },
                            '& .MuiChip-icon': {
                                marginLeft: 1,
                                marginRight: 0,
                            },
                        }}
                    />
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