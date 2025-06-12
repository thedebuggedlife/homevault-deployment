import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Alert,
    FormControlLabel,
    Checkbox,
    Box,
} from '@mui/material';
import { Backup as BackupIcon } from '@mui/icons-material';

interface BackupConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (keepForever: boolean) => void;
}

const BackupConfirmationDialog: React.FC<BackupConfirmationDialogProps> = ({
    open,
    onClose,
    onConfirm,
}) => {
    const [keepForever, setKeepForever] = React.useState(false);

    const handleConfirm = () => {
        onConfirm(keepForever);
    };

    const handleClose = () => {
        setKeepForever(false); // Reset checkbox when closing
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BackupIcon color="primary" />
                    <Typography variant="h6">Run Backup Now</Typography>
                </Box>
            </DialogTitle>
            
            <DialogContent>
                <Typography variant="body1" component="p">
                    This operation will create a new backup snapshot using your existing repository configuration.
                </Typography>
                
                <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                        <strong>Note:</strong> The backup process may take several minutes to complete. During this time, 
                        some services on the server may be temporarily unavailable while their data is being backed up.
                    </Typography>
                </Alert>

                <Box sx={{ 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: 1, 
                    borderColor: 'divider',
                    borderRadius: 1,
                }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={keepForever}
                                onChange={(e) => setKeepForever(e.target.checked)}
                                color="primary"
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    Keep this snapshot forever
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    When checked, this snapshot will be tagged as "keep" and will not be automatically 
                                    deleted by the retention policy during scheduled backups.
                                </Typography>
                            </Box>
                        }
                    />
                </Box>
            </DialogContent>
            
            <DialogActions>
                <Button 
                    onClick={handleClose} 
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleConfirm}
                    variant="contained"
                    startIcon={<BackupIcon />}
                >
                    Start Backup
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BackupConfirmationDialog;