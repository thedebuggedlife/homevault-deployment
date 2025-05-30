import {
    Box,
    Button,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    Paper,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { DeploymentConfig } from '@backend/types';
import { interpolateVariables } from '@/utils/prompts/variableInterpolator';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';
import { DeployModules } from '@/types';

interface ConfirmationStepProps {
    modules: DeployModules;
    config: DeploymentConfig;
    values: Record<string, string>;
    onConfirm: () => void;
    onBack: () => void;
}

export default function ConfirmationStep({
    modules,
    config,
    values,
    onConfirm,
    onBack,
}: ConfirmationStepProps) {
    // Group configuration by module for installations
    const moduleConfigs = modules.install.map(moduleName => {
        const modulePrompts = config.prompts.filter(p => p.module === moduleName);
        const moduleValues = modulePrompts
            .filter(p => !p.condition || evaluateCondition(p.condition, values))
            .map(p => ({
                label: p.prompt,
                variable: p.variable,
                value: p.password ? '••••••••' : values[p.variable] ?? ''
            }));
        
        return {
            moduleName,
            values: moduleValues
        };
    }).filter(mc => mc.values.length > 0);

    const hasInstallations = modules.install.length > 0;
    const hasRemovals = modules.remove && modules.remove.length > 0;

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Review Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ mb: 2 }}>
                Please review your configuration before proceeding with the deployment:
            </Typography>

            {/* Modules to Install Section */}
            {hasInstallations && (
                <>
                    {!hasRemovals && moduleConfigs.length === 0 && (
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Modules to Install
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    The following modules will be reinstalled with default configuration:
                                </Typography>
                                <List dense sx={{ mt: 1 }}>
                                    {modules.install.map(moduleName => (
                                        <ListItem key={moduleName}>
                                            <ListItemText primary={moduleName} />
                                        </ListItem>
                                    ))}
                                </List>
                            </CardContent>
                        </Card>
                    )}

                    {moduleConfigs.map(({ moduleName, values: moduleValues }) => (
                        <Card key={moduleName} sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {moduleName}
                                </Typography>
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableBody>
                                            {moduleValues.map(({ label, variable, value }) => (
                                                <TableRow key={variable}>
                                                    <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                                                        {interpolateVariables(label, values)}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                                                        {value}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    ))}
                </>
            )}

            {/* Modules to Remove Section */}
            {hasRemovals && (
                <Card sx={{ mb: 3, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom color="error">
                            Modules to Remove
                        </Typography>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            The following modules will be removed. The services will no longer be available, but your data will not be lost.
                        </Alert>
                        <List dense>
                            {modules.remove!.map(moduleName => (
                                <ListItem key={moduleName}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <DeleteIcon color="error" />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary={moduleName}
                                        slotProps={{ primary: { sx: { fontWeight: 500 }}}}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            <Box mt={3} display="flex" justifyContent="space-between">
                <Button onClick={onBack} variant="outlined">
                    Back
                </Button>
                <Button 
                    onClick={onConfirm} 
                    variant="contained" 
                    color={hasRemovals ? "error" : "primary"}
                >
                    Begin Deployment
                </Button>
            </Box>
        </Box>
    );
}