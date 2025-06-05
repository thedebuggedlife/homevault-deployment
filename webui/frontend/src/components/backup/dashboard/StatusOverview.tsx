import { Paper, Typography, Box, Chip, Divider } from "@mui/material";
import { Backup as BackupIcon, CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { BackupStatus } from "@backend/types/backup";

interface BackupStatusOverviewProps {
    status: BackupStatus;
}

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

export default function StatusOverview({ status }: BackupStatusOverviewProps) {
    return (
        <Paper sx={{ p: 3, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <BackupIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Backup Status</Typography>
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
    );
}
