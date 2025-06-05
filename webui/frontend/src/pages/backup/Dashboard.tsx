import React, { useContext } from "react";
import { Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button, IconButton } from "@mui/material";
import { Cached as CachedIcon, Error as ErrorIcon, Storage as StorageIcon, PlayArrow as PlayArrowIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import backend from "@/backend";
import StatusOverview from "@/components/backup/dashboard/StatusOverview";
import BackupStatistics from "@/components/backup/dashboard/BackupStatistics";
import ScheduleStatus from "@/components/backup/dashboard/ScheduleStatus";
import { BackupContext } from "@/contexts/BackupContext";

const BackupDashboard: React.FC = () => {
    const { status, loading, error, reload } = useContext(BackupContext);
    const navigate = useNavigate();

    const handleRunBackup = async () => {
        try {
            await backend.startBackup();
            // Navigate to backup progress page (to be implemented)
        } catch (err) {
            console.error("Failed to start backup:", err);
            // For now, just show an alert
            alert("Backup functionality not yet implemented");
        }
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
                <Button onClick={reload} sx={{ ml: 2 }}>
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
                <Grid size={{ xs: 12 }}>
                    <Box display="flex" gap={2}>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleRunBackup}
                            color="primary"
                        >
                            Run Backup Now
                        </Button>
                        <IconButton
                            onClick={reload}
                            color="primary"
                        >
                            <CachedIcon />
                        </IconButton>
                    </Box>
                </Grid>

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
                <Grid size={{ xs: 12 }}>
                    <ScheduleStatus
                        schedulingEnabled={status.schedulingEnabled || false}
                        scheduleExpression={status.scheduleExpression}
                        retentionPolicy={status.retentionPolicy}
                        onConfigureSchedule={() => navigate("/backup/scheduling")}
                    />
                </Grid>
            </Grid>
        </>
    );
};

export default BackupDashboard;
