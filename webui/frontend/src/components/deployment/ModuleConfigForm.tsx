import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    InputAdornment,
    IconButton,
    Box,
    Collapse,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { DeploymentConfig } from '@backend/types';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';
import { interpolateVariables } from '@/utils/prompts/variableInterpolator';

interface ModuleConfigFormProps {
    moduleName: string;
    prompts: DeploymentConfig['prompts'];
    values: Record<string, string>;
    errors?: Record<string, string>;
    onValuesChange: (newValues: Record<string, string>) => void;
    allValues: Record<string, string>;
}

export default function ModuleConfigForm({
    moduleName,
    prompts,
    values,
    errors = {},
    onValuesChange,
    allValues,
}: ModuleConfigFormProps) {
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [userModified, setUserModified] = useState<Record<string, boolean>>({});

    const modulePrompts = prompts.filter(p => p.module === moduleName);

    useEffect(() => {
        // Initialize default values
        const newValues: Record<string, string> = { ...values };
        let hasChanges = false;

        modulePrompts.forEach(prompt => {
            if (!(prompt.variable in newValues) && prompt.default !== undefined) {
                const interpolatedDefault = interpolateVariables(prompt.default, allValues);
                newValues[prompt.variable] = interpolatedDefault;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            console.log("ModuleConfigForm: Has changes!!!");
            onValuesChange(newValues);
        }
    }, [modulePrompts, allValues, values, onValuesChange]);

    const handleChange = (variable: string, value: string, isUserInput: boolean = true) => {
        const newValues = { ...values, [variable]: value };
        onValuesChange(newValues);
        
        if (isUserInput) {
            setUserModified(prev => ({ ...prev, [variable]: true }));
            setTouched(prev => ({ ...prev, [variable]: true }));
        }
    };

    const handleBlur = (variable: string) => {
        setTouched(prev => ({ ...prev, [variable]: true }));
    };

    const getFieldError = (prompt: DeploymentConfig['prompts'][0]): string | null => {
        if (!touched[prompt.variable]) return null;
        return errors[prompt.variable];
    };

    const renderField = (prompt: DeploymentConfig['prompts'][0]) => {
        const value = values[prompt.variable] || '';
        const error = getFieldError(prompt);
        const interpolatedPrompt = interpolateVariables(prompt.prompt, allValues);
        
        // Update default value if not user-modified
        if (prompt.default && !userModified[prompt.variable]) {
            const interpolatedDefault = interpolateVariables(prompt.default, allValues);
            if (interpolatedDefault !== value) {
                handleChange(prompt.variable, interpolatedDefault, false);
            }
        }

        // Check if field has unresolved variable references
        const hasUnresolvedRefs = interpolatedPrompt.includes('{') && interpolatedPrompt.includes('}');

        if (prompt.options && prompt.options.length > 0) {
            return (
                <FormControl fullWidth error={!!error}>
                    <InputLabel>{interpolatedPrompt}</InputLabel>
                    <Select
                        value={value}
                        onChange={(e) => handleChange(prompt.variable, e.target.value)}
                        onBlur={() => handleBlur(prompt.variable)}
                        label={interpolatedPrompt}
                        disabled={hasUnresolvedRefs}
                    >
                        {prompt.options.map(option => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                    {error && <FormHelperText>{error}</FormHelperText>}
                    {hasUnresolvedRefs && (
                        <FormHelperText>Waiting for referenced values...</FormHelperText>
                    )}
                </FormControl>
            );
        }

        return (
            <TextField
                fullWidth
                label={interpolatedPrompt}
                value={value}
                onChange={(e) => handleChange(prompt.variable, e.target.value)}
                onBlur={() => handleBlur(prompt.variable)}
                error={!!error}
                helperText={error || (hasUnresolvedRefs ? 'Waiting for referenced values...' : '')}
                required={!prompt.optional}
                disabled={hasUnresolvedRefs}
                type={prompt.password && !showPassword[prompt.variable] ? 'password' : 'text'}
                slotProps={{
                    input: prompt.password ? {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => setShowPassword(prev => ({
                                        ...prev,
                                        [prompt.variable]: !prev[prompt.variable]
                                    }))}
                                    edge="end"
                                >
                                    {showPassword[prompt.variable] ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        )
                    } : undefined
                }}
            />
        );
    };

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {moduleName} Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    {modulePrompts.map(prompt => {
                        const shouldShow = !prompt.condition || evaluateCondition(prompt.condition, allValues);
                        
                        return (
                            <Collapse key={prompt.variable} in={shouldShow}>
                                {renderField(prompt)}
                            </Collapse>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
}