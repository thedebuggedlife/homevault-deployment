import { BackupSchedule } from "@backend/types/backup";
import { Card, CardContent, Typography, TextField, FormHelperText, Box } from "@mui/material";
import { useEffect, useState } from "react";

interface RetentionPolicyProps {
    schedule: BackupSchedule;
    onChange: (retentionPolicy: string) => void;
    onValidation: (isValid: boolean) => void;
}

export default function RetentionPolicy({ schedule, onChange, onValidation }: RetentionPolicyProps) {
    const [error, setError] = useState<string>(null);

    const validateRetentionPolicy = (policy: string): string | undefined => {
        if (!policy.trim()) {
            return "Retention policy is required";
        }

        if (policy.toLowerCase() === "all") {
            return undefined; // "all" is valid
        }

        // Check format: should match pattern like 7d, 4w, 12m, 5y
        const pattern = /^(\d+[hdwmy])+$/i;
        if (!pattern.test(policy)) {
            return "Invalid format. Use combinations of #h, #d, #w, #m, #y (e.g., 7d4w12m) or 'all'";
        }

        return undefined;
    };

    const formatRetentionPreview = (policy: string): string => {
        // Parse the retention policy
        const parts = policy.match(/(\d+[hdwmy])/g);
        if (!parts) return "Keep all snapshots";

        const descriptions: string[] = [];
        parts.forEach((part) => {
            const num = parseInt(part);
            const unit = part[part.length - 1];
            switch (unit) {
                case "h":
                    descriptions.push(`${num} hourly`);
                    break;
                case "d":
                    descriptions.push(`${num} daily`);
                    break;
                case "w":
                    descriptions.push(`${num} weekly`);
                    break;
                case "m":
                    descriptions.push(`${num} monthly`);
                    break;
                case "y":
                    descriptions.push(`${num} yearly`);
                    break;
            }
        });

        return `Keep ${descriptions.join(", ")} snapshots`;
    };

    const handleChange = (value: string) => {
        onChange(value);
    };

    useEffect(() => {
        const error = validateRetentionPolicy(schedule.retentionPolicy);
        setError(error);
        onValidation(!error);
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
                    helperText={error || formatRetentionPreview(schedule.retentionPolicy)}
                />
                {!error && (
                    <FormHelperText>
                        Format: [#h][#d][#w][#m][#y] where h=hourly, d=daily, w=weekly, m=monthly, y=yearly. Example:
                        "7d4w12m" keeps 7 daily, 4 weekly, and 12 monthly snapshots. Use "all" to keep all snapshots.
                    </FormHelperText>
                )}

                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Common policies:</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        • "7d4w12m" - Good for most use cases
                        <br />
                        • "30d" - Keep daily snapshots for a month
                        <br />
                        • "7d4w12m5y" - Long-term retention with yearly snapshots
                        <br />• "all" - Never delete any snapshots
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
