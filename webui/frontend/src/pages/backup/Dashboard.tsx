import React, { useEffect, useState } from "react";
import {
    Container,
    Grid,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Button,
    Chip,
    Card,
    CardContent,
    Divider,
} from "@mui/material";
import {
    Backup as BackupIcon,
    Schedule as ScheduleIcon,
    Storage as StorageIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    PlayArrow as PlayArrowIcon,
    StackedLineChart as StackedLineChartIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import backend from "@/backend";
import { BackupStatus } from "@/types/backup";

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
    } else {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days ago`;
    }
}

function formatCronExpression(cron: string): string {
    // Simple conversion of common patterns
    if (cron === "0 2 * * *") return "Daily at 2:00 AM";
    if (cron === "0 0 * * 0") return "Weekly on Sunday at midnight";
    if (cron === "0 0 1 * *") return "Monthly on the 1st at midnight";
    return cron; // Return raw expression for complex patterns
}

const BackupDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchBackupStatus();
    }, []);

    const fetchBackupStatus = async () => {
        try {
            const response = await backend.getBackupStatus();
            setStatus(response);
            setError("");
        } catch (err) {
            setError("Failed to load backup status");
        } finally {
            setLoading(false);
        }
    };

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
                        The backup system has not been initialized. Please configure a repository to start creating backups.
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
                    </Box>
                </Grid>

                {/* Status Overview */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: "100%" }}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                            <BackupIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="h6">
                                Backup Status
                            </Typography>
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <CheckCircleIcon color="success" />
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        System Status
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                        Initialized
                                    </Typography>
                                </Box>
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Repository Type
                                </Typography>
                                <Chip 
                                    label={status.repositoryType?.toUpperCase() || "Unknown"} 
                                    color="primary" 
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                />
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Repository Location
                                </Typography>
                                <Typography variant="body1" sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                                    {status.repositoryLocation}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Last Backup
                                </Typography>
                                <Typography variant="body1">
                                    {status.lastBackupTime ? formatRelativeTime(status.lastBackupTime) : "Never"}
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                {/* Repository Statistics */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                            <StackedLineChartIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="h6">
                                Repository Statistics
                            </Typography>
                        </Box>

                        <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                            <Grid size={6}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h4" color="primary" align="center">
                                            {status.snapshotCount || 0}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" align="center">
                                            Total Snapshots
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={6}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h4" color="primary" align="center">
                                            {status.totalSize || "0 GB"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" align="center">
                                            Total Size
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3 }}>
                            <Button 
                                fullWidth 
                                variant="outlined"
                                onClick={() => navigate("/backup/snapshots")}
                            >
                                View All Snapshots
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Scheduling Status */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                            <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="h6">
                                Backup Schedule
                            </Typography>
                        </Box>

                        {status.schedulingEnabled ? (
                            <Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                                    <Chip 
                                        label="Enabled" 
                                        color="success" 
                                        size="small"
                                    />
                                    <Typography variant="body1">
                                        {formatCronExpression(status.scheduleExpression || "")}
                                    </Typography>
                                </Box>
                                
                                {status.retentionPolicy && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Retention Policy: <strong>{status.retentionPolicy}</strong>
                                        </Typography>
                                    </Box>
                                )}

                                <Box sx={{ mt: 2 }}>
                                    <Button 
                                        variant="outlined"
                                        size="small"
                                        onClick={() => navigate("/backup/scheduling")}
                                    >
                                        Modify Schedule
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <Box>
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    Automatic backups are not scheduled. Enable scheduling to run backups automatically.
                                </Alert>
                                <Button 
                                    variant="contained"
                                    startIcon={<ScheduleIcon />}
                                    onClick={() => navigate("/backup/scheduling")}
                                >
                                    Configure Schedule
                                </Button>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </>
    );
};

export default BackupDashboard;