import { Alert, Button } from '@mui/material';
import FullPageLayout from '@/layouts/fullpage';
import DeploymentHeader from './DeploymentHeader';
import { useNavigate } from 'react-router-dom';

interface ErrorStateProps {
    error: string;
    onRetry: () => void;
    title: string;
    backPath: string;
    backTitle: string;
}

export default function ErrorState({ error, onRetry, title, backPath, backTitle }: ErrorStateProps) {
    const navigate = useNavigate();
    
    return (
        <FullPageLayout
            headerContent={
                <DeploymentHeader 
                    backTitle={backTitle} 
                    onBack={() => navigate(backPath)} 
                />
            }
            title={title}
        >
            <Alert severity="error">
                {error}
                <Button onClick={onRetry} sx={{ ml: 2 }}>
                    Retry
                </Button>
            </Alert>
        </FullPageLayout>
    );
}