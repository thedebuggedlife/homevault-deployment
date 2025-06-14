import { Paper, Typography, Box, Button, Card, CardContent, Grid } from "@mui/material";
import { StackedLineChart as StackedLineChartIcon } from "@mui/icons-material";
import { formatBytes } from "@/utils/units";

interface BackupStatisticsProps {
    snapshotCount: number;
    totalSize: number;
    onViewSnapshots: () => void;
}

export default function BackupStatistics({ snapshotCount, totalSize, onViewSnapshots }: BackupStatisticsProps) {
    return (
        <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <StackedLineChartIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Repository Statistics</Typography>
            </Box>

            <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                <Grid size={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h4" color="primary" align="center">
                                {snapshotCount}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                Total Snapshots
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h4" color="primary" align="center">
                                {formatBytes(totalSize)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                Total Size
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
                <Button fullWidth variant="outlined" onClick={onViewSnapshots}>
                    View All Snapshots
                </Button>
            </Box>
        </Paper>
    );
}
