import {  useEffect, useRef } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
} from '@mui/material';
import { DeploymentConfig } from '@backend/types';
import { evaluateCondition } from '@/utils/prompts/conditionEvaluator';
import autoAnimate from '@formkit/auto-animate'
import ModuleConfigField from './ModuleConfigField';

interface ModuleConfigFormProps {
    moduleName: string;
    prompts: DeploymentConfig['prompts'];
    values: Record<string, string>;
    userModified: Record<string, boolean>;
    errors?: Record<string, string>;
    onUserModified: (variable: string) => void;
    onValuesChange: (newValues: Record<string, string>) => void;
}

export default function ModuleConfigForm({
    moduleName,
    prompts,
    values,
    userModified,
    errors = {},
    onUserModified,
    onValuesChange,
}: ModuleConfigFormProps) {
    const parent = useRef(null);

    const modulePrompts = prompts.filter(p => p.module === moduleName);

    useEffect(() => {
        parent.current && autoAnimate(parent.current);
    }, [parent]);

    const handleChange = (variable: string, value: string, isUserInput: boolean = true) => {
        const newValues = { ...values, [variable]: value };
        onValuesChange(newValues);
        
        if (isUserInput) {
            onUserModified(variable);
        }
    };

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Configuration for {moduleName}:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }} ref={parent}>
                    {modulePrompts.map(prompt => {
                        const shouldShow = !prompt.condition || evaluateCondition(prompt.condition, values);
                        if (!shouldShow) return null;
                        return (
                            <Box key={prompt.variable}>
                                <ModuleConfigField 
                                    allValues={values} 
                                    error={errors[prompt.variable]} 
                                    prompt={prompt} 
                                    userModified={userModified[prompt.variable]} 
                                    handleChange={handleChange} 
                                />
                            </Box>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
}