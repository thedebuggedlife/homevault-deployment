import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    Alert,
    Box,
    CircularProgress
} from '@mui/material';
import { GetModulesResponse } from '@backend/types';
import InstallModuleItem from './InstallModuleItem';

interface InstallModuleDialogProps {
    open: boolean;
    onClose: () => void;
    onInstall: (modules: string[]) => void;
    modulesData: GetModulesResponse | null;
    loading: boolean;
}

export function InstallModuleDialog({
    open,
    onClose,
    onInstall,
    modulesData,
    loading
}: InstallModuleDialogProps) {
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

    const handleClose = () => {
        setSelectedModules(new Set());
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

    const handleInstall = () => {
        onInstall(Array.from(selectedModules));
        setSelectedModules(new Set());
    };

    const getAvailableModules = () => {
        if (!modulesData) return {};
        
        const { installedModules, availableModules } = modulesData;
        const installed = new Set(installedModules);
        
        return Object.entries(availableModules).reduce((acc, [name, description]) => {
            if (!installed.has(name)) {
                acc[name] = description;
            }
            return acc;
        }, {} as Record<string, string>);
    };

    const availableModules = getAvailableModules();

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Install New Modules</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Box display="flex" justifyContent="center" py={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {Object.keys(availableModules).length === 0 ? (
                            <Alert severity="info">
                                All available modules are already installed.
                            </Alert>
                        ) : (
                            <List>
                                {Object.entries(availableModules).map(([name, description]) => (
                                    <InstallModuleItem
                                        key={name}
                                        name={name}
                                        description={description}
                                        selected={selectedModules.has(name)}
                                        onToggle={handleToggleModule}
                                    />
                                ))}
                            </List>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button 
                    onClick={handleInstall}
                    variant="contained"
                    disabled={selectedModules.size === 0}
                >
                    Install
                </Button>
            </DialogActions>
        </Dialog>
    );
}