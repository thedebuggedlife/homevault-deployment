import { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { DeploymentConfig } from '@backend/types';
import ModuleConfigForm from './ModuleConfigForm';
import { validateTimezone } from '@/utils/prompts/validators';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';

interface ConfigurationStepProps {
    modules: string[];
    config: DeploymentConfig;
    onComplete: (values: Record<string, string>) => void;
}

export default function ConfigurationStep({ modules, config, onComplete }: ConfigurationStepProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Initialize values with defaults from ALL prompts in the config, not just selected modules
    useEffect(() => {
        const initialValues: Record<string, string> = {};
        
        config.prompts.forEach(prompt => {
            if (prompt.default !== undefined) {
                // For now, set the raw default. It will be interpolated later in ModuleConfigForm
                initialValues[prompt.variable] = prompt.default;
            }
        });
        
        setValues(initialValues);
    }, [config]);

    const handleModuleValuesChange = useCallback((moduleValues: Record<string, string>) => {
        setValues(prev => ({
            ...prev,
            ...moduleValues
        }));
    }, []);

    const validateAllFields = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        config.prompts.forEach(prompt => {
            const value = values[prompt.variable] || '';

            // Ignore fields that do not meet their condition
            if (prompt.condition && !evaluateCondition(prompt.condition, values)) {
                return;
            }

            // Check required fields
            if (!prompt.optional && !value) {
                newErrors[prompt.variable] = 'Required field';
                isValid = false;
                return;
            }
            
            // Check regex validation
            if (value && prompt.regex) {
                for (const regex of prompt.regex) {
                    if (regex.pattern === 'is_valid_timezone') {
                        if (!validateTimezone(value)) {
                            newErrors[prompt.variable] = regex.message || 'Invalid timezone';
                            isValid = false;
                            return;
                        }
                    } else {
                        try {
                            const pattern = new RegExp(regex.pattern);
                            if (!pattern.test(value)) {
                                newErrors[prompt.variable] = regex.message || 'Invalid format';
                                isValid = false;
                                return;
                            }
                        } catch {
                            console.error(`Invalid regex pattern for ${prompt.variable}:`, regex.pattern);
                        }
                    }
                }
            }
        });

        setErrors(newErrors);
        return isValid;
    }, [config, values]);

    // Calculate if all fields are valid without setting errors
    const allFieldsValid = useMemo(() => validateAllFields(), [validateAllFields]);

    const handleContinue = () => {
        if (validateAllFields()) {
            onComplete(values);
        }
    };

    if (!config || config.prompts.length === 0) {
        // No configuration needed, proceed directly
        onComplete({});
        return null;
    }

    // Group prompts by module
    const moduleGroups = modules.map(moduleName => ({
        moduleName,
        prompts: config.prompts.filter(p => p.module === moduleName)
    })).filter(group => group.prompts.length > 0);

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Configuration Required
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p">
                Please provide the following configuration for the selected modules:
            </Typography>

            {moduleGroups.map(({ moduleName }) => (
                <ModuleConfigForm
                    key={moduleName}
                    moduleName={moduleName}
                    prompts={config.prompts}
                    values={values}
                    errors={errors} 
                    onValuesChange={handleModuleValuesChange}
                    allValues={values}
                />
            ))}

            <Box mt={3} display="flex" justifyContent="flex-end">
                <Button
                    variant="contained"
                    onClick={handleContinue}
                    disabled={!allFieldsValid}
                >
                    Continue
                </Button>
            </Box>
        </Box>
    );
}