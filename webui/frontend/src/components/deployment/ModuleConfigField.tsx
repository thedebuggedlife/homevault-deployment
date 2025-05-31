import { interpolateVariables } from "@/utils/prompts/variableInterpolator";
import { DeploymentPrompt } from "@backend/types";
import { VisibilityOff, Visibility } from "@mui/icons-material";
import { FormControl, InputLabel, Select, MenuItem, FormHelperText, TextField, InputAdornment, IconButton } from "@mui/material";
import { useState } from "react";

interface ModuleConfigFieldProps {
    allValues: Record<string, string>;
    error: string;
    prompt: DeploymentPrompt;
    userModified: boolean;
    handleChange: (variable: string, value: string, userInput?: boolean) => void;
}

export default function ModuleConfigField({allValues, error, prompt, userModified, handleChange}: ModuleConfigFieldProps) {
    const [touched, setTouched] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const interpolatedPrompt = interpolateVariables(prompt.prompt, allValues);
    const value = allValues[prompt.variable] ?? "";

    const hasError = error && touched;
    
    // Update default value if not user-modified
    if (value && !userModified) {
        const interpolatedDefault = interpolateVariables(value, allValues);
        if (interpolatedDefault !== value) {
            handleChange(prompt.variable, interpolatedDefault, false);
        }
    }

    // Check if field has unresolved variable references
    const hasUnresolvedRefs = interpolatedPrompt.includes('{') && interpolatedPrompt.includes('}');

    if (prompt.options && prompt.options.length > 0) {
        return (
            <FormControl fullWidth error={hasError}>
                <InputLabel>{interpolatedPrompt}</InputLabel>
                <Select
                    value={value}
                    onChange={(e) => handleChange(prompt.variable, e.target.value)}
                    onBlur={() => setTouched(true)}
                    label={interpolatedPrompt}
                    disabled={hasUnresolvedRefs}
                >
                    {prompt.options.map(option => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </Select>
                {hasError && <FormHelperText>{error}</FormHelperText>}
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
            onBlur={() => setTouched(true)}
            error={hasError}
            helperText={(hasError && error) || (hasUnresolvedRefs ? 'Waiting for referenced values...' : '')}
            required={!prompt.optional}
            disabled={hasUnresolvedRefs}
            type={prompt.password && !showPassword ? 'password' : 'text'}
            slotProps={{
                input: prompt.password ? {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                onClick={() => setShowPassword(prev => !prev)}
                                edge="end"
                            >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    )
                } : undefined
            }}
        />
    );
}