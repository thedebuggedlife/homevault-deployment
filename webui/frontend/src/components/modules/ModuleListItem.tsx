import {
    ListItem,
    ListItemText,
    Chip,
    Box,
    Collapse,
    Typography,
    Divider
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { FaDocker as DockerIcon } from 'react-icons/fa';
import { ModuleContainerInfo } from '@/utils/docker';
import ContainerTable from '@/components/docker/ContainerTable';

interface ModuleListItemProps {
    moduleName: string;
    containerInfo: ModuleContainerInfo;
    isExpanded: boolean;
    isLast: boolean;
    onClick: () => void;
}

export default function ModuleListItem({
    moduleName,
    containerInfo,
    isExpanded,
    isLast,
    onClick
}: ModuleListItemProps) {
    return (
        <>
            <ListItem
                onClick={onClick}
                sx={{
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: 'action.hover',
                    }
                }}
            >
                <ListItemText
                    primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {moduleName}
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
                                            marginRight: 0.2,
                                        },
                                    }}
                                />
                            </Box>
                            {containerInfo.total > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                </Box>
                            )}
                        </Box>
                    }
                />
            </ListItem>

            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                    {containerInfo.containers.length > 0 ? (
                        <ContainerTable containers={containerInfo.containers} />
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                            No containers found for this module
                        </Typography>
                    )}
                </Box>
            </Collapse>

            {!isLast && <Divider />}
        </>
    );
}