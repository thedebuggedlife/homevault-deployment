import {
    CheckCircle,
    Error,
    Warning,
    Pause,
    RestartAlt,
    Stop
} from '@mui/icons-material';

interface StatusIconProps {
    status: string;
}

export default function StatusIcon({ status }: StatusIconProps) {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('healthy')) {
        return <CheckCircle color="success" fontSize="small" />;
    } else if (statusLower.includes('unhealthy')) {
        return <Error color="error" fontSize="small" />;
    } else if (statusLower.includes('starting')) {
        return <Warning color="warning" fontSize="small" />;
    } else if (statusLower.includes('restarting')) {
        return <RestartAlt color="warning" fontSize="small" />;
    } else if (statusLower.includes('paused')) {
        return <Pause color="warning" fontSize="small" />;
    } else if (statusLower.includes('exited') || statusLower.includes('dead')) {
        return <Stop color="error" fontSize="small" />;
    }
    
    return null;
}