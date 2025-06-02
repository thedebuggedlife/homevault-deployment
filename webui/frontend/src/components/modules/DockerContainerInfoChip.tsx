import { ModuleContainerInfo } from "@/utils/docker";
import { Chip } from "@mui/material";
import { FaDocker as DockerIcon } from 'react-icons/fa';

export interface DockerContainerInfoChipProps {
    containerInfo: ModuleContainerInfo,
}

export function DockerContainerInfoChip({containerInfo}: DockerContainerInfoChipProps) {
    return (<Chip
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
    />)
}