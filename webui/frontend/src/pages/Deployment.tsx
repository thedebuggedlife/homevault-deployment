import { useLocation, useNavigate } from 'react-router-dom';
import { Typography, Box, Card, CardContent, Button, Stepper, Step, StepLabel, Alert, CircularProgress, StepIconProps, StepIcon, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeploymentConfig } from '@backend/types';
import ConfigurationStep from '@/components/deployment/ConfigurationStep';
import ConfirmationStep from '@/components/deployment/ConfirmationStep';
import Terminal from '@/components/deployment/Terminal';
import backend, { DeploymentOperation } from '@/backend';
import FullPageLayout from '@/layouts/fullpage';
import { NavigationBlocker } from '@/components/NavigationBlocker';

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
    const [deploymentError, setDeploymentError] = useState<string | null>(null);
    const [installationOutput, setInstallationOutput] = useState<string[]>([]);
    const [isInstalling, setIsInstalling] = useState(false);
    const [operation, setOperation] = useState<DeploymentOperation | null>(null);
    
    // Password dialog state
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    
    const deploymentSteps = ['Configuration', 'Confirmation', 'Deployment'];

    const STEP_CONFIGURATION = 0;
    const STEP_CONFIRMATION = 1;
    const STEP_INSTALLATION = 2;

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

    const handleConfigurationComplete = (values: Record<string, string>) => {
        setConfigValues(values);
        setActiveStep(STEP_CONFIRMATION);
    };

    const handleConfirmDeployment = () => {
        // Open password dialog instead of directly starting deployment
        setPasswordDialogOpen(true);
        setPassword('');
        setPasswordError('');
    };

    const handlePasswordSubmit = async () => {
        if (!password.trim()) {
            setPasswordError('Password is required');
            return;
        }

        // Close dialog and start deployment
        setPasswordDialogOpen(false);
        setActiveStep(STEP_INSTALLATION);
        setError(null);
        setDeploymentError(null);
        setInstallationOutput([]);
        setIsInstalling(true);
        
        try {
            const request = {
                modules: {
                    install: modules,
                },
                config: {
                    variables: configValues,
                    password: password
                }
            }
            const operation = await backend.startDeployment(request);
            operation.on("output", (output: string) => {
                setInstallationOutput(prev => [...prev, output]);
            });
            operation.on("completed", () => {
                setIsInstalling(false);
                operation.close();
            })
            operation.on("error", (message: string) => {
                setDeploymentError(message ?? "Something went wrong. Please try again.");
                setIsInstalling(false);
            })
            setOperation(operation);
        } catch (err) {
            setError('Failed to start deployment. Please try again.');
            setActiveStep(STEP_CONFIRMATION);
            setIsInstalling(false);
        } finally {
            // Clear password from memory
            setPassword('');
        }
    };

    const handlePasswordCancel = () => {
        setPasswordDialogOpen(false);
        setPassword('');
        setPasswordError('');
    };

    const handlePasswordKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handlePasswordSubmit();
        }
    };

    useEffect(() => {
        return () => {
            if (operation) {
                operation.close();
            }
        };
    }, [operation]);

    // Header content with back button
    const headerContent = (
        <Button 
            startIcon={<ArrowBack />} 
            onClick={() => navigate(backPath)}
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

    const stepIcon = (props: StepIconProps) => isInstalling && props.active ? <CircularProgress size={24} thickness={4} /> : <StepIcon {...props} />;

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
                    <Stepper
                        activeStep={activeStep}
                    >
                        {deploymentSteps.map((label) => (
                            <Step key={label}>
                                <StepLabel StepIconComponent={stepIcon}>
                                    {label}
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </CardContent>
            </Card>

            {activeStep === STEP_CONFIGURATION && deploymentConfig && (
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

            {activeStep === STEP_CONFIRMATION && deploymentConfig && (
                <Card>
                    <CardContent>
                        <ConfirmationStep
                            modules={modules}
                            config={deploymentConfig}
                            values={configValues}
                            onConfirm={handleConfirmDeployment}
                            onBack={() => setActiveStep(STEP_CONFIGURATION)}
                        />
                    </CardContent>
                </Card>
            )}

            {activeStep === STEP_INSTALLATION && isInstalling && (
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
                        <Terminal output={installationOutput} />
                    </CardContent>
                    <NavigationBlocker
                        title="Deployment in Progress"
                        message="The deployment process will continue to run in the background. Are you sure you want to leave?"
                    />
                </Card>
            )}

            {activeStep === STEP_INSTALLATION && !isInstalling && (
                <Card>
                    <CardContent>
                        <Box textAlign="center" sx={{ marginBottom: 2 }}>
                            { !deploymentError && (
                                <>
                                    <Typography variant="h6" color="success.main" gutterBottom>
                                        Deployment Complete!
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" component="p">
                                        The selected modules have been successfully installed and configured.
                                    </Typography>
                                </>
                            )}
                            { deploymentError && (
                                <>
                                    <Typography variant="h6" color="error.main" gutterBottom>
                                        Deployment Failed!
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" component="p">
                                        {deploymentError}
                                    </Typography>
                                </>
                            )}
                        </Box>
                        <Terminal output={installationOutput} />
                        <Box display="flex" justifyContent="center" my={1}>
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

            {/* Password Dialog */}
            <Dialog 
                open={passwordDialogOpen} 
                onClose={handlePasswordCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Authentication Required
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Please enter the password for user <Box component="strong" sx={{ color: 'primary.main' }}>
                        {deploymentConfig?.username ?? "installer"}
                        </Box> to proceed with the deployment.
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Password"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) setPasswordError('');
                        }}
                        onKeyUp={handlePasswordKeyPress}
                        error={!!passwordError}
                        helperText={passwordError}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handlePasswordCancel}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handlePasswordSubmit} 
                        variant="contained"
                        disabled={!password.trim()}
                    >
                        Continue
                    </Button>
                </DialogActions>
            </Dialog>
        </FullPageLayout>
    );
}