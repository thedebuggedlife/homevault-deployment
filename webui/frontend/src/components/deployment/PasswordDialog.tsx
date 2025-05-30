import { useState, useCallback } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    TextField, 
    Button, 
    Typography, 
    Box 
} from '@mui/material';

interface PasswordDialogProps {
    open: boolean;
    username: string;
    onSubmit: (password: string) => void;
    onCancel: () => void;
}

export default function PasswordDialog({ open, username, onSubmit, onCancel }: PasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = useCallback(() => {
        if (!password.trim()) {
            setError('Password is required');
            return;
        }
        onSubmit(password);
        // Clear password after submit
        setPassword('');
        setError('');
    }, [password, onSubmit]);

    const handleCancel = useCallback(() => {
        setPassword('');
        setError('');
        onCancel();
    }, [onCancel]);

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleCancel}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Authentication Required
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Please enter the password for user{' '}
                    <Box component="strong" sx={{ color: 'primary.main' }}>
                        {username}
                    </Box>{' '}
                    to proceed with the deployment.
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
                        if (error) setError('');
                    }}
                    onKeyUp={handleKeyPress}
                    error={!!error}
                    helperText={error}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained"
                    disabled={!password.trim()}
                >
                    Continue
                </Button>
            </DialogActions>
        </Dialog>
    );
}