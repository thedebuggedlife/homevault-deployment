import React, { useContext, useState } from "react";
import { Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button, IconButton } from "@mui/material";
import { Cached as CachedIcon, Error as ErrorIcon, Storage as StorageIcon, PlayArrow as PlayArrowIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import backend from "@/backend/backend";
import StatusOverview from "@/components/backup/dashboard/StatusOverview";
import BackupStatistics from "@/components/backup/dashboard/BackupStatistics";
import ScheduleStatus from "@/components/backup/dashboard/ScheduleStatus";
import { BackupContext } from "@/contexts/BackupContext";
import BackupConfirmationDialog from "@/components/backup/dashboard/BackupConfirmationDialog";

const BackupDashboard: React.FC = () => {
    const { status, loading, error, reload } = useContext(BackupContext);
    const navigate = useNavigate();
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [backupRunning, setBackupRunning] = useState(false);
    const [backupError, setBackupError] = useState<string>();
    const [backupSuccess, setBackupSuccess] = useState(false);

    const handleReload = () => {
        setBackupError(null);
        setBackupSuccess(false);
        reload();
    }

    const handleRunBackup = async () => {
        setBackupError(null);
        setBackupSuccess(false);
        setConfirmDialogOpen(true);
    };

    const handleConfirmBackup = async (keepForever: boolean) => {
        try {
            setConfirmDialogOpen(false);
            setBackupRunning(true);
            await backend.startBackup(keepForever);
            setBackupSuccess(true);
        } catch (error) {
            setBackupError("Backup operation failed. " + (error.message ?? ""));
        } finally {
            setBackupRunning(false);
        }
    };

    const handleCancelBackup = () => {
        setConfirmDialogOpen(false);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
                <Button onClick={handleReload} sx={{ ml: 2 }}>
                    Retry
                </Button>
            </Alert>
        );
    }

    if (!status?.initialized) {
        return (
            <Container>
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <ErrorIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
                    <Typography variant="h5" gutterBottom>
                        Backup Not Configured
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        The backup system has not been initialized. Please configure a repository to start creating
                        backups.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<StorageIcon />}
                        onClick={() => navigate("/backup/repository")}
                    >
                        Configure Repository
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <>
            <Grid container spacing={3}>
                {/* Quick Actions */}
                <Grid size={12}>
                    <Box display="flex" justifyContent="end" gap={2}>
                        <IconButton
                            onClick={handleReload}
                            color="primary"
                        >
                            <CachedIcon />
                        </IconButton>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleRunBackup}
                            color="primary"
                            loading={backupRunning}
                            loadingPosition="start"
                        >
                            Run Backup Now
                        </Button>
                    </Box>
                </Grid>

                {/* Error and success alert bars */}
                {backupError && (
                    <Grid size={12}>
                        <Alert severity="error"onClose={() => setBackupError(null)}>
                            {backupError}
                        </Alert>
                    </Grid>
                )}
                {backupSuccess && (
                    <Grid size={12}>
                        <Alert severity="success" onClose={() => setBackupSuccess(false)}>
                            Backup completed successfully. Details in this section may be out of date until reloaded.
                            <Button onClick={handleReload} sx={{ ml: 2 }}>
                                Reload Now
                            </Button>
                        </Alert>
                    </Grid>
                )}

                {/* Status Overview */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <StatusOverview status={status} />
                </Grid>

                {/* Repository Statistics */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <BackupStatistics
                        snapshotCount={status.snapshotCount || 0}
                        totalSize={status.totalSize || 0}
                        onViewSnapshots={() => navigate("/backup/snapshots")}
                    />
                </Grid>

                {/* Scheduling Status */}
                <Grid size={12}>
                    <ScheduleStatus
                        schedule={status.schedule}
                        onConfigureSchedule={() => navigate("/backup/scheduling")}
                    />
                </Grid>
            </Grid>

            {/* Backup Confirmation Dialog */}
            <BackupConfirmationDialog
                open={confirmDialogOpen}
                onClose={handleCancelBackup}
                onConfirm={handleConfirmBackup}
            />
        </>
    );
};

export default BackupDashboard;
