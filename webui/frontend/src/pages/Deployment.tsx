import { useLocation, useNavigate, Navigate } from 'react-router';
import { Typography, Box, Card, CardContent, Button, Stepper, Step, StepLabel, Container, LinearProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';

interface DeploymentState {
    modules: string[];
    backPath?: string;
    backTitle?: string;
}

export default function Deployment() {
    const location = useLocation();
    const navigate = useNavigate();
    const { session, loading: sessionLoading } = useSession();
    const [activeStep, setActiveStep] = useState(0);
    
    // Get the state from navigation
    const state = location.state as DeploymentState;
    const modules = state?.modules || [];
    const backPath = state?.backPath || '/';
    const backTitle = state?.backTitle || 'Home';

    const steps = ['Preparing', 'Downloading', 'Installing', 'Configuring', 'Complete'];

    useEffect(() => {
        if (!sessionLoading && modules.length === 0) {
            // If no modules were passed, redirect back
            navigate(backPath);
            return;
        }

        if (modules.length > 0) {
            // TODO: Implement actual deployment logic here
            // For now, just simulate progress through steps
            const timer = setInterval(() => {
                setActiveStep((prevStep) => {
                    if (prevStep >= steps.length - 1) {
                        clearInterval(timer);
                        return prevStep;
                    }
                    return prevStep + 1;
                });
            }, 2000);

            return () => clearInterval(timer);
        }
    }, [modules, navigate, sessionLoading, backPath, steps.length]);

    const handleBack = () => {
        navigate(backPath);
    };

    // Handle authentication
    if (sessionLoading) {
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress />
            </Box>
        );
    }

    if (!session) {
        const redirectTo = `/login?callbackUrl=${encodeURIComponent(location.pathname)}`;
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: 'background.default',
            py: 3
        }}>
            <Container maxWidth="md">
                <Box mb={3}>
                    <Button 
                        startIcon={<ArrowBack />} 
                        onClick={handleBack}
                        size="small"
                    >
                        Back to {backTitle}
                    </Button>
                </Box>

                <Typography variant="h4" gutterBottom>
                    Module Deployment
                </Typography>

                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Installing Modules
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            {modules.length} module{modules.length !== 1 ? 's' : ''} selected for installation:
                        </Typography>
                        <Box component="ul" sx={{ mt: 1 }}>
                            {modules.map((module) => (
                                <li key={module}>
                                    <Typography variant="body2">{module}</Typography>
                                </li>
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Installation Progress
                        </Typography>
                        <Stepper activeStep={activeStep} sx={{ mt: 3 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                        
                        {activeStep === steps.length - 1 && (
                            <Box textAlign="center" mt={4}>
                                <Typography variant="h6" color="success.main" gutterBottom>
                                    Installation Complete!
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    onClick={handleBack}
                                    sx={{ mt: 2 }}
                                >
                                    Return to {backTitle}
                                </Button>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}