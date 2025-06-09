import { useState } from 'react';
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
import { DialogProps } from '@toolpad/core';
import _ from 'lodash';
import { SudoRequest } from '@backend/types';

export default function PasswordDialog(props: DialogProps<SudoRequest,string>) {
    const { payload: { username }, open, onClose } = props;
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !_.isEmpty(password)) {
            onClose(password);
        }
    };

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