import { BackupSchedule } from "@backend/types/backup";
import { Card, CardContent, Typography, TextField, FormHelperText, Box } from "@mui/material";
import { useEffect, useState } from "react";
import { validateRetentionPolicy, formatRetentionPolicy } from "@/utils/retentionPolicy";

interface RetentionPolicyProps {
    schedule: BackupSchedule,
    onChange: (retentionPolicy: string) => void,
    onValidation: (isValid: boolean) => void;
}

export default function RetentionPolicy({schedule, onChange, onValidation}: RetentionPolicyProps) {
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string>("");

    const handleChange = (value: string) => {
        onChange(value);
    }

    useEffect(() => {
        const validationError = validateRetentionPolicy(schedule.retentionPolicy);
        setError(validationError ?? null);
        onValidation(!validationError);
        
        if (!validationError) {
            setPreview(formatRetentionPolicy(schedule.retentionPolicy));
        } else {
            setPreview("");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule.retentionPolicy]);

    return (
        <Card variant="outlined" sx={{ opacity: schedule.enabled ? 1 : 0.6 }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Retention Policy
                </Typography>
                
                <TextField
                    label="Retention Policy"
                    value={schedule.retentionPolicy}
                    onChange={(e) => handleChange(e.target.value)}
                    fullWidth
                    disabled={!schedule.enabled}
                    error={!!error}
                    helperText={error || preview}
                />
                {!error && (
                    <FormHelperText>
                        Format: [#h][#H][#d][#D][#w][#W][#m][#M][#y][#Y] where:
                        <br />
                        • Lowercase (h,d,w,m,y) = keep only the most recent snapshot for that period
                        <br />
                        • Uppercase (H,D,W,M,Y) = keep all snapshots for that period
                        <br />
                        • Use "all" to keep all snapshots indefinitely
                    </FormHelperText>
                )}

                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Common policies:</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                        • <strong>7D4W12M10Y</strong> - Default policy, good for most use cases<br />
                        <span style={{ marginLeft: '1.5em', fontSize: '0.875em' }}>
                            (Keep all daily snapshots for 7 days, all weekly for 4 weeks, all monthly for 12 months, all yearly for 10 years)
                        </span><br />
                        
                        • <strong>24H7D</strong> - Keep all hourly snapshots for the past day and all daily snapshots for the past week<br />
                        
                        • <strong>7d</strong> - Keep only the most recent daily snapshot for the last 7 days<br />
                        
                        • <strong>7d4w12m</strong> - Keep the most recent daily, weekly, and monthly snapshots<br />
                        <span style={{ marginLeft: '1.5em', fontSize: '0.875em' }}>
                            (Most recent daily for 7 days, most recent weekly for 4 weeks, most recent monthly for 12 months)
                        </span><br />
                        
                        • <strong>all</strong> - Never delete any snapshots
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    )
}