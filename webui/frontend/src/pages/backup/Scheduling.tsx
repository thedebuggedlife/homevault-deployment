import React, { useEffect, useState } from "react";
import {
    Container,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Button,
    Switch,
    FormControlLabel,
    Card,
    CardContent,
} from "@mui/material";
import { Schedule as ScheduleIcon, Save as SaveIcon, Undo as UndoIcon } from "@mui/icons-material";
import backend from "@/backend";
import { BackupSchedule } from "@backend/types/backup";
import ScheduleConfiguration from "@/components/backup/scheduling/ScheduleConfiguration";
import _ from "lodash";
import RetentionPolicy from "@/components/backup/scheduling/RetentionPolicy";

const BackupScheduling: React.FC = () => {
    const [schedule, setSchedule] = useState<BackupSchedule>({
        enabled: false,
        cronExpression: "0 2 * * *",
        retentionPolicy: "7d4w12m",
    });
    const [originalSchedule, setOriginalSchedule] = useState<BackupSchedule>({
        enabled: false,
        cronExpression: "0 2 * * *",
        retentionPolicy: "7d4w12m",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [validation, setValidation] = useState({
        cronExpression: false,
        retentionPolicy: false,
    });

    // Check if there are any changes from the original
    const hasChanges = JSON.stringify(schedule) !== JSON.stringify(originalSchedule);
    const hasErrors = !_.every(_.values(validation));

    console.log("Current", schedule);
    console.log("Original", originalSchedule);
    console.log("Has errors", hasErrors);

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            const response = await backend.getBackupSchedule();
            setSchedule(response);
            setOriginalSchedule(response); // Save the original state
            setError("");
        } catch (err) {
            setError("Failed to load schedule configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await backend.updateBackupSchedule(schedule);
            setOriginalSchedule(schedule); // Update the original state after successful save
            alert("Schedule updated successfully!");
        } catch (err) {
            console.error("Failed to save schedule:", err);
            alert("Failed to save schedule configuration");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        // Reset to original values
        setSchedule(originalSchedule);
    };

    const handleScheduleChange = (cronExpression: string) => {
        setSchedule((prev) => ({
            ...prev,
            cronExpression,
        }));
    };

    const handleScheduleValidation = (cronExpression: boolean) => {
        setValidation((prev) => ({
            ...prev,
            cronExpression,
        }));
    };

    const handleRetentionChange = (retentionPolicy: string) => {
        setSchedule((prev) => ({
            ...prev,
            retentionPolicy,
        }));
    };

    const handleRetentionValidation = (retentionPolicy: boolean) => {
        setValidation((prev) => ({
            ...prev,
            retentionPolicy,
        }));
    };

    const handleEnabledChange = (enabled: boolean) => {
        setSchedule((prev) => ({
            ...prev,
            enabled,
        }));
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

    return (
        <Container maxWidth="md">
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <ScheduleIcon color="primary" />
                        <Typography variant="h5">Backup Scheduling</Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        {hasChanges && (
                            <Button variant="outlined" startIcon={<UndoIcon />} onClick={handleReset} disabled={saving}>
                                Reset
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={!hasChanges || saving || hasErrors}
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </Box>
                </Box>

                {/* Enable/Disable Schedule */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={schedule.enabled}
                                    onChange={(e) => handleEnabledChange(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body1">Enable Automatic Backups</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        When enabled, backups will run automatically according to the schedule
                                    </Typography>
                                </Box>
                            }
                        />
                    </CardContent>
                </Card>

                {/* Schedule Configuration */}
                <ScheduleConfiguration
                    schedule={schedule}
                    onChange={handleScheduleChange}
                    onValidation={handleScheduleValidation}
                />

                {/* Retention Policy */}
                <RetentionPolicy
                    schedule={schedule}
                    onChange={handleRetentionChange}
                    onValidation={handleRetentionValidation}
                />
            </Paper>
        </Container>
    );
};

export default BackupScheduling;
