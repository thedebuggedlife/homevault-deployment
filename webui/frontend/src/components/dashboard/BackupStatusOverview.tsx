import React, { useContext } from "react";
import { 
    Paper, 
    Typography, 
    Box, 
    Chip, 
    Divider, 
    CircularProgress,
    IconButton,
    Alert,
    Button
} from "@mui/material";
import { 
    Backup as BackupIcon, 
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Refresh as RefreshIcon 
} from "@mui/icons-material";
import humanizeDuration from "humanize-duration";
import { BackupContext } from "@/contexts/BackupContext";
import { useNavigate } from "react-router-dom";

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return humanizeDuration(diffMs, { largest: 2, round: true });
}

export default function BackupStatusOverview() {
    const navigate = useNavigate();
    const { status, loading, error, reload } = useContext(BackupContext);

    return (
        <Paper sx={{ p: 3, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <BackupIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Backup Status</Typography>
                </Box>
                <IconButton 
                    size="small" 
                    onClick={reload}
                    disabled={loading}
                    sx={{ ml: 1 }}
                >
                    <RefreshIcon />
                </IconButton>
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            ) : status ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        { status.initialized ? (<CheckCircleIcon color="success" />) : (<ErrorIcon color="warning" />) }
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                System Status
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                            { status.initialized ? "Initialized" : "Not Initialized" }
                            </Typography>
                        </Box>
                    </Box>

                    <Divider />

                    { status.initialized ? (
                        <>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Repository Type
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                    <Chip
                                        label={status.repository?.repositoryType ?? "unknown"}
                                        color="primary"
                                        size="small"
                                    />
                                </Box>
                            </Box>
        
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Repository Location
                                </Typography>
                                <Typography variant="body1" sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                                    {status.repository?.location}
                                </Typography>
                            </Box>
        
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Last Backup
                                </Typography>
                                <Typography variant="body1">
                                    {status.lastBackupTime ? formatRelativeTime(status.lastBackupTime) + " ago" : "Never"}
                                </Typography>
                            </Box>
                        </>
                    ) : (
                        <>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                The backup system has not been initialized. Please configure a repository to start creating
                                backups.
                            </Typography>
                            <Button
                                variant="text"
                                onClick={() => navigate("/backup/repository")}
                            >
                                Configure Repository
                            </Button>
                        </>
                    )}
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    No backup data available
                </Typography>
            )}
        </Paper>
    );
}