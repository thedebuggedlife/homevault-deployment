import { useState, useEffect } from 'react';
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

const BASE_MODULE_DESCRIPTION = "This module installs the necessary infrastructure to support all other modules in HomeVault";

export function InstallModuleDialog({
    open,
    onClose,
    onInstall,
    modulesData,
    loading
}: InstallModuleDialogProps) {
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

    const isBaseInstalled = modulesData?.installedModules?.includes('base') ?? false;

    // Pre-select base module if not installed
    useEffect(() => {
        if (!loading && open && !isBaseInstalled) {
            setSelectedModules(new Set(['base']));
        }
    }, [loading, open, isBaseInstalled]);

    const handleClose = () => {
        setSelectedModules(new Set());
        onClose();
    };

    const handleToggleModule = (moduleName: string) => {
        // Prevent unselecting base module if it's not installed
        if (moduleName === 'base') {
            return;
        }

        const newSelected = new Set(selectedModules);
        if (newSelected.has(moduleName)) {
            newSelected.delete(moduleName);
        } else {
            newSelected.add(moduleName);
        }
        setSelectedModules(newSelected);
    };

    const handleInstall = () => {
        // Ensure base module comes first in the output array
        const modulesArray = Array.from(selectedModules);
        const sortedModules = modulesArray.sort((a, b) => {
            if (a === 'base') return -1;
            if (b === 'base') return 1;
            return 0;
        });
        
        onInstall(sortedModules);
        setSelectedModules(new Set());
    };

    const getAvailableModules = () => {
        if (!modulesData) return {};
        
        const { installedModules, availableModules } = modulesData;
        const installed = new Set(installedModules);
        
        // Get modules that aren't installed
        const uninstalledModules = Object.entries(availableModules).reduce((acc, [name, description]) => {
            if (!installed.has(name)) {
                acc[name] = description;
            }
            return acc;
        }, {} as Record<string, string>);

        // Add base module synthetically if it's not installed
        if (!isBaseInstalled) {
            return {
                base: BASE_MODULE_DESCRIPTION,
                ...uninstalledModules
            };
        }

        return uninstalledModules;
    };

    const availableModules = getAvailableModules();
    const moduleEntries = Object.entries(availableModules);
    const nonBaseModules = moduleEntries.filter(([name]) => name !== 'base');
    const showBulkActions = nonBaseModules.length > 1;

    const handleSelectAll = () => {
        const allModuleNames = new Set(moduleEntries.map(([name]) => name));
        // If base is not installed, it's already pre-selected and can't be changed
        setSelectedModules(allModuleNames);
    };

    const handleUnselectAll = () => {
        // Keep only base if it's required
        if (!isBaseInstalled && moduleEntries.some(([name]) => name === 'base')) {
            setSelectedModules(new Set(['base']));
        } else {
            setSelectedModules(new Set());
        }
    };

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
                        {moduleEntries.length === 0 ? (
                            <Alert severity="info">
                                All available modules are already installed.
                            </Alert>
                        ) : (
                            <>
                                <List>
                                    {moduleEntries.map(([name, description]) => (
                                        <InstallModuleItem
                                            key={name}
                                            name={name}
                                            description={description}
                                            selected={name === 'base' ? true : selectedModules.has(name)}
                                            onToggle={handleToggleModule}
                                            disabled={name === 'base' && !isBaseInstalled}
                                            showCoreChip={name === 'base' && !isBaseInstalled}
                                        />
                                    ))}
                                </List>
                                {showBulkActions && (
                                    <Box sx={{ display: 'flex', gap: 2, mt: 1, mb: 2 }}>
                                        <Button 
                                            size="small" 
                                            onClick={handleSelectAll}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Select all
                                        </Button>
                                        <Button 
                                            size="small" 
                                            onClick={handleUnselectAll}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Unselect all
                                        </Button>
                                    </Box>
                                )}
                            </>
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