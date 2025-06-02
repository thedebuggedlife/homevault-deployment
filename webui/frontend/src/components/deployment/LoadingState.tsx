import { Box, CircularProgress } from '@mui/material';
import FullPageLayout from '@/layouts/fullpage';
import DeploymentHeader from './DeploymentHeader';
import { useNavigate } from 'react-router-dom';

interface LoadingStateProps {
    title: string;
    backPath: string;
    backTitle: string;
}

export default function LoadingState({ title, backPath, backTitle }: LoadingStateProps) {
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
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        </FullPageLayout>
    );
}