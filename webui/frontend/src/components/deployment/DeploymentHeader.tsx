import { Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

interface DeploymentHeaderProps {
    backTitle: string;
    onBack: () => void;
}

export default function DeploymentHeader({ backTitle, onBack }: DeploymentHeaderProps) {
    return (
        <Button 
            startIcon={<ArrowBack />} 
            onClick={onBack}
            size="small"
        >
            Back to {backTitle}
        </Button>
    );
}