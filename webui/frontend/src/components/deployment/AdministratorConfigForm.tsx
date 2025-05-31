import { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Box,
    Alert,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface AdministratorConfigFormProps {
    values: Record<string, string>;
    errors: Record<string, string>;
    onValuesChange: (values: Record<string, string>) => void;
}

export default function AdministratorConfigForm({
    values,
    errors,
    onValuesChange,
}: AdministratorConfigFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const handleChange = (field: string, value: string) => {
        const newValues = { ...values, [field]: value };
        onValuesChange(newValues);
        
        // If changing password fields, validate confirmation
        if (field === 'ADMIN_PASSWORD' || field === 'ADMIN_PASSWORD_CONFIRM') {
            validatePasswordMatch(newValues);
        }
        
        // If changing email, validate format
        if (field === 'ADMIN_EMAIL') {
            validateEmail(value);
        }
    };

    const handleBlur = (field: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const validatePasswordMatch = (currentValues: Record<string, string>) => {
        const password = currentValues.ADMIN_PASSWORD || '';
        const confirmPassword = currentValues.ADMIN_PASSWORD_CONFIRM || '';
        
        if (confirmPassword && password !== confirmPassword) {
            errors.ADMIN_PASSWORD_CONFIRM = 'Passwords do not match';
        } else {
            delete errors.ADMIN_PASSWORD_CONFIRM;
        }
    };

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            errors.ADMIN_EMAIL = 'Invalid email format';
        } else {
            delete errors.ADMIN_EMAIL;
        }
    };

    const getFieldError = (field: string): string | null => {
        if (!touched[field]) return null;
        return errors[field] || null;
    };

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Administrator Account
                </Typography>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                    This user will have administrator privileges across all applications
                </Alert>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        fullWidth
                        label="Username"
                        value={values.ADMIN_USERNAME || ''}
                        onChange={(e) => handleChange('ADMIN_USERNAME', e.target.value)}
                        onBlur={() => handleBlur('ADMIN_USERNAME')}
                        error={!!getFieldError('ADMIN_USERNAME')}
                        helperText={getFieldError('ADMIN_USERNAME')}
                        required
                    />

                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={values.ADMIN_EMAIL || ''}
                        onChange={(e) => handleChange('ADMIN_EMAIL', e.target.value)}
                        onBlur={() => handleBlur('ADMIN_EMAIL')}
                        error={!!getFieldError('ADMIN_EMAIL')}
                        helperText={getFieldError('ADMIN_EMAIL')}
                        required
                    />

                    <TextField
                        fullWidth
                        label="Display Name"
                        value={values.ADMIN_DISPLAY_NAME || ''}
                        onChange={(e) => handleChange('ADMIN_DISPLAY_NAME', e.target.value)}
                        onBlur={() => handleBlur('ADMIN_DISPLAY_NAME')}
                        error={!!getFieldError('ADMIN_DISPLAY_NAME')}
                        helperText={getFieldError('ADMIN_DISPLAY_NAME')}
                        required
                    />

                    <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={values.ADMIN_PASSWORD || ''}
                        onChange={(e) => handleChange('ADMIN_PASSWORD', e.target.value)}
                        onBlur={() => handleBlur('ADMIN_PASSWORD')}
                        error={!!getFieldError('ADMIN_PASSWORD')}
                        helperText={getFieldError('ADMIN_PASSWORD')}
                        required
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                    <TextField
                        fullWidth
                        label="Confirm Password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={values.ADMIN_PASSWORD_CONFIRM || ''}
                        onChange={(e) => handleChange('ADMIN_PASSWORD_CONFIRM', e.target.value)}
                        onBlur={() => handleBlur('ADMIN_PASSWORD_CONFIRM')}
                        error={!!getFieldError('ADMIN_PASSWORD_CONFIRM')}
                        helperText={getFieldError('ADMIN_PASSWORD_CONFIRM')}
                        required
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            edge="end"
                                        >
                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}