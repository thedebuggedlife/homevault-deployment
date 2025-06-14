import { BackupSchedule } from "@backend/types/backup";
import { Card, CardContent, Typography, TextField, FormHelperText, Grid, Alert } from "@mui/material";
import { useEffect, useState } from "react";
import { validateRetentionPolicy } from "@/utils/retentionPolicy";
import RetentionPolicyExamples from "./RetentionPolicyExamples";

interface RetentionPolicyProps {
    disabled: boolean;
    schedule: BackupSchedule;
    onChange: (retentionPolicy: string) => void;
    onValidation: (isValid: boolean) => void;
}

export default function RetentionPolicy({ disabled, schedule, onChange, onValidation }: RetentionPolicyProps) {
    const [error, setError] = useState<string | null>(null);

    const handleChange = (value: string) => {
        onChange(value);
    };

    useEffect(() => {
        const validationError = validateRetentionPolicy(schedule.retentionPolicy);
        setError(validationError ?? null);
        onValidation(!validationError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule.retentionPolicy]);

    return (
        <Card variant="outlined" sx={{ opacity: schedule.enabled ? 1 : 0.6 }}>
            <CardContent>
                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Typography variant="h6" gutterBottom>
                            Retention Policy
                        </Typography>
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label="Retention Policy"
                            value={schedule.retentionPolicy}
                            onChange={(e) => handleChange(e.target.value)}
                            fullWidth
                            disabled={disabled || !schedule.enabled}
                            error={!!error}
                            helperText={error}
                        />
                        {!error && (
                            <FormHelperText>
                                Format: [#h][#H][#d][#D][#w][#W][#m][#M][#y][#Y]
                            </FormHelperText>
                        )}
                    </Grid>

                    <Grid size={12}>
                        <Alert severity="info">
                            <Typography variant="body2">
                                <strong>Tip:</strong> For details on the format, visit the{" "}
                                <a
                                    href="https://thedebugged.life/homevault/backup-and-restore/#configuring-retention-policy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    HomeVault backup documentation
                                </a>.
                            </Typography>
                        </Alert>
                    </Grid>

                    <Grid size={12}>
                        <RetentionPolicyExamples />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}
