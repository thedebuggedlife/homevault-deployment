import { useLocation, useNavigate } from 'react-router';
import { Typography, Box, Card, CardContent, Button, Stepper, Step, StepLabel, Alert, CircularProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeploymentConfig } from '@backend/types';
import ConfigurationStep from '@/components/deployment/ConfigurationStep';
import ConfirmationStep from '@/components/deployment/ConfirmationStep';
import backend from '@/backend';
import FullPageLayout from '@/layouts/fullpage';

interface DeploymentState {
    modules: string[];
    backPath?: string;
    backTitle?: string;
}

export default function Deployment() {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [configValues, setConfigValues] = useState<Record<string, string>>({});
    const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deploymentComplete, setDeploymentComplete] = useState(false);
    
    const deploymentSteps = ['Configuration', 'Confirmation', 'Running', 'Complete'];

    // Get the state from navigation
    const { modules, backPath, backTitle } = useMemo(() => {
        const state = location.state as DeploymentState;
        return {
            modules: state?.modules || [],
            backPath: state?.backPath || '/',
            backTitle: state?.backTitle || 'Home'
        };
    }, [location.state]);

    const loadDeploymentConfig = useCallback(async () => {
        if (modules.length === 0) return;
        
        try {
            setConfigLoading(true);
            setError(null);
            
            const config = await backend.getDeploymentConfig({
                modules: {
                    install: modules
                }
            });
            
            setDeploymentConfig(config);
        } catch (err) {
            setError('Failed to load deployment configuration');
            console.error('Error:', err);
        } finally {
            setConfigLoading(false);
        }
    }, [modules]);

    // Load deployment configuration when modules are available
    useEffect(() => { loadDeploymentConfig() }, [modules, loadDeploymentConfig]);

    useEffect(() => {
        if (modules.length === 0) {
            // If no modules were passed, redirect back
            navigate(backPath);
            return;
        }
    }, [modules, navigate, backPath]);

    useEffect(() => {
        if (activeStep === 2 && !deploymentComplete) {
            // Simulate deployment progress when in "Running" step
            const timer = setTimeout(() => {
                setDeploymentComplete(true);
                setActiveStep(3); // Move to "Complete"
            }, 5000); // Simulate 5 seconds of deployment

            return () => clearTimeout(timer);
        }
    }, [activeStep, deploymentComplete]);

    const handleExit = () => {
        if (activeStep == 2) {
            if (!window.confirm('Deployment is in progress. Are you sure you want to leave?')) {
                return;
            }
        }
        navigate(backPath);
    }

    const handleBack = () => {
        if (activeStep == 2) {
            if (!window.confirm('Deployment is in progress. Are you sure you want to leave?')) {
                return;
            }
        }
        if (activeStep === 0) {
            navigate(backPath);
        } else if (activeStep === 1) {
            setActiveStep(0);
        } else {
            navigate(backPath);
        }
    };

    const handleConfigurationComplete = (values: Record<string, string>) => {
        setConfigValues(values);
        setActiveStep(1); // Move to "Confirmation"
    };

    const handleConfirmDeployment = async () => {
        setActiveStep(2); // Move to "Running"
        setError(null);
        
        try {
            // TODO: Implement actual deployment API call here
            // For now, we just simulate the deployment with the timer
            
            // Example of what the actual implementation might look like:
            // const response = await backend.deployModules({
            //     modules: { install: modules },
            //     configuration: configValues
            // });
            
            console.log('Starting deployment with config:', configValues);
        } catch (err) {
            setError('Deployment failed. Please try again.');
            console.error('Deployment error:', err);
            setActiveStep(1); // Go back to confirmation
        }
    };

    // Header content with back button
    const headerContent = (
        <Button 
            startIcon={<ArrowBack />} 
            onClick={handleExit}
            size="small"
        >
            Back to {backTitle}
        </Button>
    );

    const pageTitle = "Module Deployment"

    // Show loading while config is being fetched
    if (configLoading) {
        return (
            <FullPageLayout
                headerContent={headerContent}
                title={pageTitle}
            >
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                    <CircularProgress />
                </Box>
            </FullPageLayout>
        );
    }

    // Show error if config loading failed
    if (error && !deploymentConfig) {
        return (
            <FullPageLayout
                headerContent={headerContent}
                title={pageTitle}
            >
                <Alert severity="error">
                    {error}
                    <Button onClick={loadDeploymentConfig} sx={{ ml: 2 }}>
                        Retry
                    </Button>
                </Alert>
            </FullPageLayout>
        );
    }

    return (
        <FullPageLayout
            headerContent={headerContent}
            title={pageTitle}
        >
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Stepper activeStep={activeStep}>
                        {deploymentSteps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </CardContent>
            </Card>

            {activeStep === 0 && deploymentConfig && (
                <Card>
                    <CardContent>
                        <ConfigurationStep
                            modules={modules}
                            config={deploymentConfig}
                            onComplete={handleConfigurationComplete}
                        />
                    </CardContent>
                </Card>
            )}

            {activeStep === 1 && deploymentConfig && (
                <Card>
                    <CardContent>
                        <ConfirmationStep
                            modules={modules}
                            config={deploymentConfig}
                            values={configValues}
                            onConfirm={handleConfirmDeployment}
                            onBack={handleBack}
                        />
                    </CardContent>
                </Card>
            )}

            {activeStep === 2 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Deployment in Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="p">
                            Installing and configuring the following modules:
                        </Typography>
                        <Box component="ul" sx={{ mt: 1, mb: 3 }}>
                            {modules.map((module) => (
                                <li key={module}>
                                    <Typography variant="body2">{module}</Typography>
                                </li>
                            ))}
                        </Box>
                        <Box display="flex" justifyContent="center" my={4}>
                            <CircularProgress />
                        </Box>
                        <Typography variant="body2" color="text.secondary" align="center">
                            Please wait while the deployment is in progress...
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {activeStep === 3 && (
                <Card>
                    <CardContent>
                        <Box textAlign="center">
                            <Typography variant="h6" color="success.main" gutterBottom>
                                Deployment Complete!
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="p">
                                The selected modules have been successfully installed and configured.
                            </Typography>
                            <Button 
                                variant="contained" 
                                onClick={() => navigate(backPath)}
                                sx={{ mt: 2 }}
                            >
                                Return to {backTitle}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}
        </FullPageLayout>
    );
}