import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    Typography,
    Box,
    CircularProgress,
    Alert,
    Button,
    Switch,
    FormControlLabel,
    Card,
    CardContent,
    IconButton,
} from "@mui/material";
import {
    Cached as CachedIcon,
    Save as SaveIcon,
    Undo as UndoIcon,
} from "@mui/icons-material";
import backend from "@/backend/backend";
import { BackupSchedule } from "@backend/types/backup";
import ScheduleConfiguration from "@/components/backup/scheduling/ScheduleConfiguration";
import _ from "lodash";
import RetentionPolicy from "@/components/backup/scheduling/RetentionPolicy";
import { BackupContext } from "@/contexts/BackupContext";

const BackupScheduling: React.FC = () => {
    const { status, loading, error, setStatus, reload } = useContext(BackupContext);
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
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string>();
    const [validation, setValidation] = useState({
        cronExpression: false,
        retentionPolicy: false,
    });

    // Check if there are any changes from the original
    const hasChanges = !_.isEqual(schedule, originalSchedule);
    const hasErrors = !_.every(_.values(validation));

    useEffect(() => {
        setSaveError(null);
        if (status?.schedule) {
            setSchedule(status?.schedule);
            setOriginalSchedule(status?.schedule);
        }
    }, [status?.schedule]);

    const handleSave = useCallback(async () => {
        try {
            setSaveError(null);
            setSaving(true);
            await backend.updateBackupSchedule(schedule);
            setOriginalSchedule(schedule);
            setStatus({ ...status, schedule });
        } catch (error) {
            console.error("Failed to save schedule:", error);
            let message = "Failed to save schedule configuration";
            if (error.message) {
                message += " " + error.message;
            }
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }, [schedule, setStatus, status]);

    const handleReset = () => {
        // Reset to original values
        setSaveError(null);
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
                <Button onClick={reload} sx={{ ml: 2 }}>
                    Retry
                </Button>
            </Alert>
        );
    }

    return (
        <>
            {saveError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {saveError}
                </Alert>
            )}
            <Box sx={{ display: "flex", justifyContent: "end", gap: 2, mb: 3 }}>
                {!hasChanges && (
                    <IconButton onClick={reload} color="primary">
                        <CachedIcon />
                    </IconButton>
                )}
                {hasChanges && (
                    <Button variant="outlined" startIcon={<UndoIcon />} onClick={handleReset} disabled={saving}>
                        Reset
                    </Button>
                )}
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    loading={saving}
                    loadingPosition="start"
                    disabled={!hasChanges || hasErrors}
                >
                    Save
                </Button>
            </Box>

            {/* Enable/Disable Schedule */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <FormControlLabel
                        control={
                            <Switch
                                disabled={saving}
                                checked={schedule?.enabled}
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
                disabled={saving}
                schedule={schedule}
                onChange={handleScheduleChange}
                onValidation={handleScheduleValidation}
            />

            {/* Retention Policy */}
            <RetentionPolicy
                disabled={saving}
                schedule={schedule}
                onChange={handleRetentionChange}
                onValidation={handleRetentionValidation}
            />
        </>
    );
};

export default BackupScheduling;
