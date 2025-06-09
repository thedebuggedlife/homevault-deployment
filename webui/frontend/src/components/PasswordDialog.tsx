import { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    TextField, 
    Button, 
    Typography, 
    Box,
    LinearProgress
} from '@mui/material';
import { DialogProps } from '@toolpad/core';
import _ from 'lodash';
import { SudoRequest } from '@backend/types';

export default function PasswordDialog(props: DialogProps<SudoRequest,string>) {
    const { payload: { username, timeoutMs }, open, onClose } = props;
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [deadline, setDeadline] = useState<number>(0);

    // Initialize timer when dialog opens
    useEffect(() => {
        if (open) {
            const now = Date.now();
            setDeadline(now + timeoutMs);
            setRemainingTime(timeoutMs);
        }
    }, [open, timeoutMs]);

    // Handle countdown and auto-close
    useEffect(() => {
        if (!open || deadline === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, deadline - now);
            setRemainingTime(remaining);

            if (remaining === 0) {
                onClose(null);
            }
        }, 100); // Update every 100ms for smooth progress

        return () => clearInterval(interval);
    }, [open, deadline, onClose]);

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !_.isEmpty(password)) {
            onClose(password);
        }
    };

    // Calculate progress percentage (100-0) for emptying effect
    const progressValue = timeoutMs > 0 
        ? (remainingTime / timeoutMs) * 100 
        : 0;

    // Format remaining seconds for display
    const remainingSeconds = Math.ceil(remainingTime / 1000);

    return (
        <Dialog 
            open={open} 
            onClose={() => onClose(null)}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Authentication Required
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Please enter the password for user{' '}
                    <Box component="strong" sx={{ color: 'primary.main' }}>
                        {username}
                    </Box>{' '}
                    to proceed with the deployment.
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {remainingSeconds} seconds remaining
                </Typography>
                
                <LinearProgress 
                    variant="determinate" 
                    value={progressValue}
                    sx={{ 
                        mb: 3,
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: remainingTime < 15000 ? 'error.main' : undefined
                        }
                    }}
                />
                
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
                <Button onClick={() => onClose(null)}>
                    Cancel
                </Button>
                <Button 
                    onClick={() => onClose(password)} 
                    variant="contained"
                    disabled={_.isEmpty(password)}
                >
                    Continue
                </Button>
            </DialogActions>
        </Dialog>
    );
}