import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import Terminal from './Terminal';
import { NavigationBlocker } from '@/components/NavigationBlocker';
import { DeployModules } from '@/types';

interface InstallationStepProps {
    modules: DeployModules;
    isInstalling: boolean;
    output: string[];
    error: string | null;
    onReturn: () => void;
    backTitle: string;
}

export default function InstallationStep({ 
    modules, 
    isInstalling, 
    output, 
    error, 
    onReturn, 
    backTitle 
}: InstallationStepProps) {
    return (
        <Card>
            <CardContent>
                {isInstalling ? (
                    <>
                        <Typography variant="h6" gutterBottom>
                            Deployment in Progress
                        </Typography>
                        { modules.install.length > 0 &&
                        <>
                            <Typography variant="body2" color="text.secondary" component="p">
                                Installing the following modules:
                            </Typography>
                            <Box component="ul" sx={{ mt: 1, mb: 3 }}>
                                {modules.install.map((module) => (
                                    <li key={module}>
                                        <Typography variant="body2">{module}</Typography>
                                    </li>
                                ))}
                            </Box>
                        </>
                        }
                        { modules.remove.length > 0 &&
                        <>
                            <Typography variant="body2" color="text.secondary" component="p">
                                Removing the following modules:
                            </Typography>
                            <Box component="ul" sx={{ mt: 1, mb: 3 }}>
                                {modules.remove.map((module) => (
                                    <li key={module}>
                                        <Typography variant="body2">{module}</Typography>
                                    </li>
                                ))}
                            </Box>
                        </>
                        }
                    </>
                ) : (
                    <Box textAlign="center" sx={{ marginBottom: 2 }}>
                        {!error ? (
                            <>
                                <Typography variant="h6" color="success.main" gutterBottom>
                                    Deployment Complete!
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography variant="h6" color="error.main" gutterBottom>
                                    Deployment Failed!
                                </Typography>
                                <Typography variant="body2" color="text.secondary" component="p">
                                    {error}
                                </Typography>
                            </>
                        )}
                    </Box>
                )}
                
                <Terminal output={output} />
                
                {!isInstalling && (
                    <Box display="flex" justifyContent="center" my={1}>
                        <Button 
                            variant="contained" 
                            onClick={onReturn}
                            sx={{ mt: 2 }}
                        >
                            Return to {backTitle}
                        </Button>
                    </Box>
                )}
            </CardContent>
            
            {isInstalling && (
                <NavigationBlocker
                    title="Deployment in Progress"
                    message="The deployment process will continue to run in the background. Are you sure you want to leave?"
                />
            )}
        </Card>
    );
}