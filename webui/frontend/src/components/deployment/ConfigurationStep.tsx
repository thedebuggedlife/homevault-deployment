import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { DeploymentConfig } from '@backend/types';
import ModuleConfigForm from './ModuleConfigForm';
import AdministratorConfigForm from './AdministratorConfigForm';
import { validateTimezone } from '@/utils/prompts/validators';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';

interface ConfigurationStepProps {
    modules: string[];
    config: DeploymentConfig;
    onComplete: (values: Record<string, string>) => void;
    onUserModified: (variable: string) => void;
    initialValues?: Record<string, string>;
    userModified: Record<string, boolean>;
}

export default function ConfigurationStep({ modules, config, onComplete, initialValues, userModified, onUserModified }: ConfigurationStepProps) {
    const [values, setValues] = useState<Record<string, string>>(() => {
        // If we have initial values (from navigating back), use those
        if (initialValues && Object.keys(initialValues).length > 0) {
            console.log("We have initial values", initialValues)
            return initialValues;
        }

        console.log("Using default values");
        
        // Otherwise, initialize with defaults from config
        const defaultValues: Record<string, string> = {};
        
        config.prompts.forEach(prompt => {
            if (prompt.default !== undefined) {
                // For now, set the raw default. It will be interpolated later in ModuleConfigForm
                defaultValues[prompt.variable] = prompt.default;
            }
        });
        
        return defaultValues;
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Check if base module is being installed
    const isInstallingBase = modules.includes('base');

    const handleModuleValuesChange = useCallback((moduleValues: Record<string, string>) => {
        setValues(prev => ({
            ...prev,
            ...moduleValues
        }));
    }, []);

    const handleAdminValuesChange = useCallback((adminValues: Record<string, string>) => {
        setValues(prev => ({
            ...prev,
            ...adminValues
        }));
    }, []);

    const validateAllFields = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        // Validate module prompts
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

        // Validate administrator fields if base module is being installed
        if (isInstallingBase) {
            // Validate username
            if (!values.ADMIN_USERNAME) {
                newErrors.ADMIN_USERNAME = 'Username is required';
                isValid = false;
            }

            // Validate email
            if (!values.ADMIN_EMAIL) {
                newErrors.ADMIN_EMAIL = 'Email is required';
                isValid = false;
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(values.ADMIN_EMAIL)) {
                    newErrors.ADMIN_EMAIL = 'Invalid email format';
                    isValid = false;
                }
            }

            // Validate display name
            if (!values.ADMIN_DISPLAY_NAME) {
                newErrors.ADMIN_DISPLAY_NAME = 'Display name is required';
                isValid = false;
            }

            // Validate password
            if (!values.ADMIN_PASSWORD) {
                newErrors.ADMIN_PASSWORD = 'Password is required';
                isValid = false;
            }

            // Validate password confirmation
            if (!values.ADMIN_PASSWORD_CONFIRM) {
                newErrors.ADMIN_PASSWORD_CONFIRM = 'Password confirmation is required';
                isValid = false;
            } else if (values.ADMIN_PASSWORD !== values.ADMIN_PASSWORD_CONFIRM) {
                newErrors.ADMIN_PASSWORD_CONFIRM = 'Passwords do not match';
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    }, [config, values, isInstallingBase]);

    // Calculate if all fields are valid without setting errors
    const allFieldsValid = useMemo(() => validateAllFields(), [validateAllFields]);

    const handleContinue = () => {
        if (validateAllFields()) {
            // Remove password confirmation from final values
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { ADMIN_PASSWORD_CONFIRM, ...finalValues } = values;
            onComplete(finalValues);
        }
    };

    if (!config || (config.prompts.length === 0 && !isInstallingBase)) {
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
                Deployment Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ mb: 2 }}>
                Please provide the following configuration for the selected modules:
            </Typography>

            {moduleGroups.map(({ moduleName }) => (
                <Box key={moduleName}>
                    <ModuleConfigForm
                        moduleName={moduleName}
                        prompts={config.prompts}
                        values={values}
                        errors={errors} 
                        onValuesChange={handleModuleValuesChange}
                        userModified={userModified}
                        onUserModified={onUserModified}
                    />
                    
                    {/* Show Administrator form after base module */}
                    {moduleName === 'base' && isInstallingBase && (
                        <AdministratorConfigForm
                            values={values}
                            errors={errors}
                            onValuesChange={handleAdminValuesChange}
                        />
                    )}
                </Box>
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