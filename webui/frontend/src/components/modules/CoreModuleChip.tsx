import { Tooltip, Chip } from "@mui/material";
import { Lock as LockIcon } from '@mui/icons-material';

export interface CoreModuleChipProps {
    tooltip?: string
}

export default function CoreModuleChip({tooltip}: CoreModuleChipProps) {
    const chip = (
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
    );
    if (tooltip) {
        return (<Tooltip title={tooltip ?? ""}>
                    {chip}
                </Tooltip>);
    }
    return chip;
}