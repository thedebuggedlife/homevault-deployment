import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Grid, Box, CircularProgress, Button } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { InstallModuleDialog } from '@/components/modules/InstallModuleDialog';
import { RemoveModuleDialog } from '@/components/modules/RemoveModuleDialog';
import { useModulesData } from '@/hooks/useModulesData';
import { useSession } from '@/contexts/SessionContext';
import ModulesList from '@/components/modules/ModulesList';

export default function Modules() {
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [installDialogOpen, setInstallDialogOpen] = useState(false);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
    const navigate = useNavigate();
    const { activity } = useSession();
    
    const {
        status,
        modulesData,
        error,
        loading,
        loadingModules,
        fetchAvailableModules
    } = useModulesData();

    const handleModuleClick = (moduleName: string) => {
        setExpandedModule(prev => prev === moduleName ? null : moduleName);
    };

    const handleOpenInstallDialog = async () => {
        setInstallDialogOpen(true);
        await fetchAvailableModules();
    };

    const handleCloseInstallDialog = () => {
        setInstallDialogOpen(false);
    };

    const handleInstallModules = async (modules: string[]) => {
        handleCloseInstallDialog();
        navigate('/deployment', {
            state: { 
                modules: {
                    install: modules
                },
                backPath: '/modules',
                backTitle: 'Modules'
            }
        });
    };

    const handleOpenRemoveDialog = () => {
        setRemoveDialogOpen(true);
    };

    const handleCloseRemoveDialog = () => {
        setRemoveDialogOpen(false);
    };

    const handleRemoveModules = async (modules: string[]) => {
        handleCloseRemoveDialog();
        // Navigate to deployment page with removal action
        navigate('/deployment', {
            state: { 
                modules: {
                    remove: modules
                },
                action: 'remove',
                backPath: '/modules',
                backTitle: 'Modules'
            }
        });
    };

    if (error) {
        return (
            <Typography color="error" variant="h6">
                {error}
            </Typography>
        );
    }

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    const hasModules = status?.installedModules && status?.installedModules.length > 0;

    const hasRemovableModules = status?.installedModules && 
        status.installedModules.filter(m => m !== 'base').length > 0;

    return (
        <>
            <Grid size={{ xs: 12 }}>
                <Box sx={{ display: "flex", justifyContent: "end", gap: 2, mb: 3 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenInstallDialog}
                        disabled={!!activity}
                    >
                        Add Modules
                    </Button>
                    {hasRemovableModules && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<RemoveIcon />}
                            onClick={handleOpenRemoveDialog}
                            disabled={!!activity}
                        >
                            Remove Modules
                        </Button>
                    )}
                </Box>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                    {hasModules ? (
                        <ModulesList
                            modules={status?.installedModules}
                            dockerContainers={status?.dockerContainers}
                            expandedModule={expandedModule}
                            onModuleClick={handleModuleClick}
                        />
                    ) : (
                        <Box textAlign="center" py={4}>
                            <Typography variant="body1" color="text.secondary" gutterBottom>
                                There are no modules installed
                            </Typography>
                        </Box>
                    )}
                </Grid>
            </Grid>

            <InstallModuleDialog
                open={installDialogOpen}
                onClose={handleCloseInstallDialog}
                onInstall={handleInstallModules}
                modulesData={modulesData}
                loading={loadingModules}
            />

            <RemoveModuleDialog
                open={removeDialogOpen}
                onClose={handleCloseRemoveDialog}
                onRemove={handleRemoveModules}
                installedModules={status?.installedModules || []}
            />
        </>
    );
}