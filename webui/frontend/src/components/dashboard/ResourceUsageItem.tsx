import { Box, Typography, Chip, LinearProgress } from "@mui/material";

function getUsageColor(percentage: number): "success" | "warning" | "error" {
    if (percentage < 70) return "success";
    if (percentage < 90) return "warning";
    return "error";
}

export default function ResourceUsageItem({
    icon,
    label,
    percentage,
    details,
}: {
    icon: React.ReactNode;
    label: string;
    percentage: number;
    details?: string;
}) {
    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                {icon}
                <Typography variant="subtitle1" sx={{ ml: 1, fontWeight: "medium" }}>
                    {label}
                </Typography>
                <Box sx={{ ml: "auto" }}>
                    <Chip
                        label={`${percentage.toFixed(1)}%`}
                        color={getUsageColor(percentage)}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            </Box>
            <LinearProgress
                variant="determinate"
                value={percentage}
                color={getUsageColor(percentage)}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
            />
            {details && (
                <Typography variant="body2" color="text.secondary">
                    {details}
                </Typography>
            )}
        </Box>
    );
}