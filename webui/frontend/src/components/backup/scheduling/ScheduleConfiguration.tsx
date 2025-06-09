import { BackupSchedule } from "@backend/types/backup";
import { Alert, Card, CardContent, FormHelperText, Grid, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import cronParser from "cron-parser";

interface ScheduleInterfaceProps {
    disabled: boolean;
    schedule: BackupSchedule;
    onChange: (schedule: string) => void;
    onValidation: (isValid: boolean) => void;
}

export default function ScheduleConfiguration({ disabled, schedule, onChange, onValidation }: ScheduleInterfaceProps) {
    const [error, setError] = useState<string>(null);

    const handleChange = (value: string) => {
        onChange(value);
    };

    useEffect(() => {
        try {
            cronParser.parse(schedule.cronExpression);
            setError(null);
            onValidation(true);
        } catch (error) {
            setError(error.message ?? "Invalid cron expression");
            onValidation(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule.cronExpression]);

    return (
        <Card variant="outlined" sx={{ mb: 3, opacity: schedule.enabled ? 1 : 0.6 }}>
            <CardContent>
                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Typography variant="h6" gutterBottom>
                            Schedule Configuration
                        </Typography>
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label="Cron Expression"
                            value={schedule.cronExpression}
                            onChange={(e) => handleChange(e.target.value)}
                            fullWidth
                            disabled={disabled || !schedule.enabled}
                            error={!!error}
                            helperText={error}
                        />
                        {!error && (
                            <FormHelperText>
                                Use standard cron format. Examples: "0 2 * * *" (daily at 2 AM), "0 0 * * 0" (weekly on
                                Sunday)
                            </FormHelperText>
                        )}
                    </Grid>

                    <Grid size={12}>
                        <Alert severity="info">
                            <Typography variant="body2">
                                <strong>Tip:</strong> For a visual cron expression editor, visit{" "}
                                <a
                                    href="https://www.uptimia.com/cron-expression-generator"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Cron Expression Generator
                                </a>
                            </Typography>
                        </Alert>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}
