import { Paper, Typography, Box, Chip, Divider } from "@mui/material";
import { Backup as BackupIcon, CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { BackupStatus } from "@backend/types/backup";
import humanizeDuration from "humanize-duration";

interface BackupStatusOverviewProps {
    status: BackupStatus;
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return humanizeDuration(diffMs, { largest: 2, round: true });
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
            </Box>
        </Paper>
    );
}
