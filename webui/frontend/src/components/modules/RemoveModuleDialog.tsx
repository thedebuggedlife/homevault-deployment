import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Checkbox,
    Alert,
    Box,
    Typography
} from '@mui/material';

interface RemoveModuleDialogProps {
    open: boolean;
    onClose: () => void;
    onRemove: (modules: string[]) => void;
    installedModules: string[];
}

export function RemoveModuleDialog({
    open,
    onClose,
    onRemove,
    installedModules
}: RemoveModuleDialogProps) {
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Filter out 'base' module as it cannot be removed
    const removableModules = installedModules.filter(module => module !== 'base');

    const handleClose = () => {
        setSelectedModules(new Set());
        setShowConfirmation(false);
        onClose();
    };

    const handleToggleModule = (moduleName: string) => {
        const newSelected = new Set(selectedModules);
        if (newSelected.has(moduleName)) {
            newSelected.delete(moduleName);
        } else {
            newSelected.add(moduleName);
        }
        setSelectedModules(newSelected);
    };

    const handleRemoveClick = () => {
        if (selectedModules.size > 0) {
            setShowConfirmation(true);
        }
    };

    const handleConfirmRemove = () => {
        onRemove(Array.from(selectedModules));
        setSelectedModules(new Set());
        setShowConfirmation(false);
    };

    const handleCancelConfirmation = () => {
        setShowConfirmation(false);
    };

    if (showConfirmation) {
        return (
            <Dialog
                open={open}
                onClose={handleCancelConfirmation}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Confirm Module Removal</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        All containers and data associated with these modules will be removed.
                    </Alert>
                    <Typography variant="body1" gutterBottom>
                        Are you sure you want to remove the following module{selectedModules.size > 1 ? 's' : ''}?
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                        {Array.from(selectedModules).map(module => (
                            <Typography key={module} variant="body2" sx={{ ml: 2 }}>
                                • {module}
                            </Typography>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelConfirmation}>Cancel</Button>
                    <Button 
                        onClick={handleConfirmRemove}
                        variant="contained"
                        color="error"
                    >
                        Remove
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Remove Modules</DialogTitle>
            <DialogContent>
                {removableModules.length === 0 ? (
                    <Alert severity="info">
                        No modules can be removed. The base module cannot be removed.
                    </Alert>
                ) : (
                    <>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Select modules to remove. The base module cannot be removed.
                        </Alert>
                        <List>
                            {removableModules.map((module) => (
                                <ListItem key={module} disablePadding>
                                    <ListItemButton 
                                        onClick={() => handleToggleModule(module)}
                                        dense
                                    >
                                        <Checkbox
                                            edge="start"
                                            checked={selectedModules.has(module)}
                                            tabIndex={-1}
                                            disableRipple
                                        />
                                        <ListItemText primary={module} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button 
                    onClick={handleRemoveClick}
                    variant="contained"
                    color="error"
                    disabled={selectedModules.size === 0}
                >
                    Remove Selected
                </Button>
            </DialogActions>
        </Dialog>
    );
}