import { useEffect, useState } from "react";
import { Paper, Typography, Box, Button, Chip, Alert } from "@mui/material";
import { Schedule as ScheduleIcon } from "@mui/icons-material";
import cronParser from "cron-parser";
import cronstrue from "cronstrue";

interface BackupScheduleStatusProps {
    schedulingEnabled: boolean;
    scheduleExpression?: string;
    retentionPolicy?: string;
    onConfigureSchedule: () => void;
}

export default function ScheduleStatus({
    schedulingEnabled,
    scheduleExpression,
    retentionPolicy,
    onConfigureSchedule,
}: BackupScheduleStatusProps) {
    const [meaning, setMeaning] = useState<string>();

    useEffect(() => {
        try {
            cronParser.parse(scheduleExpression);
            setMeaning(cronstrue.toString(scheduleExpression));
        } catch (error) {
            setMeaning("");
        }
    }, [scheduleExpression]);
    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Backup Schedule</Typography>
            </Box>

            {schedulingEnabled ? (
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                        <Chip label="Enabled" color="success" size="small" />
                        <Typography variant="body1">{meaning}</Typography>
                    </Box>

                    {retentionPolicy && (
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                Retention Policy: <strong>{retentionPolicy}</strong>
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ mt: 2 }}>
                        <Button variant="outlined" size="small" onClick={onConfigureSchedule}>
                            Modify Schedule
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Automatic backups are not scheduled. Enable scheduling to run backups automatically.
                    </Alert>
                    <Button variant="contained" onClick={onConfigureSchedule}>
                        Configure Schedule
                    </Button>
                </Box>
            )}
        </Paper>
    );
}
