import { useState } from 'react';
import { Typography, Grid, Box, CircularProgress, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { InstalledModulesCard } from '@/components/modules/InstalledModulesCard';
import { InstallModuleDialog } from '@/components/modules/InstallModuleDialog';
import { useModulesData } from '@/hooks/useModulesData';

export default function Modules() {
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [installDialogOpen, setInstallDialogOpen] = useState(false);
    
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
        // TODO: Implement actual installation logic
        console.log('Installing modules:', modules);
        handleCloseInstallDialog();
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

    return (
        <>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                    <InstalledModulesCard
                        modules={status?.installedModules || []}
                        dockerContainers={status?.dockerContainers || []}
                        expandedModule={expandedModule}
                        onModuleClick={handleModuleClick}
                    />
                </Grid>
                
                <Grid size={{ xs: 12 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenInstallDialog}
                    >
                        Add Module
                    </Button>
                </Grid>
            </Grid>

            <InstallModuleDialog
                open={installDialogOpen}
                onClose={handleCloseInstallDialog}
                onInstall={handleInstallModules}
                modulesData={modulesData}
                loading={loadingModules}
            />
        </>
    );
}