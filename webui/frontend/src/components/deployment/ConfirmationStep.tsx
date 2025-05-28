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
} from '@mui/material';
import { DeploymentConfig } from '@backend/types';
import { interpolateVariables } from '@/utils/prompts/variableInterpolator';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';

interface ConfirmationStepProps {
    modules: string[];
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
    // Group configuration by module
    const moduleConfigs = modules.map(moduleName => {
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

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Review Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ mb: 2 }}>
                Please review your configuration before proceeding with the deployment:
            </Typography>

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

            <Box mt={3} display="flex" justifyContent="space-between">
                <Button onClick={onBack} variant="outlined">
                    Back
                </Button>
                <Button onClick={onConfirm} variant="contained" color="primary">
                    Begin Deployment
                </Button>
            </Box>
        </Box>
    );
}