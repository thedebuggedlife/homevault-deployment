import React, { useEffect, useState } from "react";
import {
    Container,
    Grid,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    LinearProgress,
    Chip,
    Divider,
} from "@mui/material";
import { Computer, Memory, Storage, Speed } from "@mui/icons-material";
import { SystemResources, SystemStatusResponse } from "@backend/types";
import backend from "@/backend";

function formatBytes(bytes: number, decimals = 1) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

function memoryUsage(resources?: SystemResources): number {
    if (resources?.memoryTotal && resources?.memoryUsage) {
        return (resources.memoryUsage / resources.memoryTotal) * 100;
    }
    return 0;
}

function diskUsage(resources?: SystemResources): number {
    if (resources?.diskTotal && resources?.diskUsage) {
        return (resources.diskUsage / resources.diskTotal) * 100;
    }
    return 0;
}

function getUsageColor(percentage: number): "success" | "warning" | "error" {
    if (percentage < 70) return "success";
    if (percentage < 90) return "warning";
    return "error";
}

const ResourceUsageItem = ({
    icon,
    label,
    percentage,
    details,
}: {
    icon: React.ReactNode;
    label: string;
    percentage: number;
    details?: string;
}) => (
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

const Dashboard: React.FC = () => {
    const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchSystemStatus();
    }, []);

    const fetchSystemStatus = async () => {
        try {
            const response = await backend.getStatus();
            setSystemStatus(response);
            setError("");
        } catch (err) {
            setError("Failed to load system status");
        } finally {
            setLoading(false);
        }
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
            <Container>
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            </Container>
        );
    }

    const cpuUsage = systemStatus?.resources?.cpuLoad ?? 0;
    const memUsage = memoryUsage(systemStatus?.resources);
    const diskUsagePercent = diskUsage(systemStatus?.resources);

    return (
        <Grid container spacing={3}>
            {/* System Overview */}
            <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 3, height: "fit-content" }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                        <Computer color="primary" />
                        <Typography variant="h6" sx={{ ml: 1 }}>
                            System Overview
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Version
                            </Typography>
                            <Typography variant="h6" color="primary">
                                {systemStatus?.version || "Unknown"}
                            </Typography>
                        </Box>

                        <Divider />

                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Box sx={{ textAlign: "center" }}>
                                <Typography variant="h4" color="primary" fontWeight="bold">
                                    {systemStatus?.installedModules?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Installed Modules
                                </Typography>
                            </Box>

                            <Divider orientation="vertical" flexItem />

                            <Box sx={{ textAlign: "center" }}>
                                <Typography variant="h4" color="primary" fontWeight="bold">
                                    {systemStatus?.dockerContainers?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Docker Containers
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Grid>

            {/* Resource Usage */}
            <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Resource Usage
                    </Typography>

                    <ResourceUsageItem icon={<Speed color="action" />} label="CPU Usage" percentage={cpuUsage} />

                    <ResourceUsageItem
                        icon={<Memory color="action" />}
                        label="Memory Usage"
                        percentage={memUsage}
                        details={`${formatBytes(systemStatus?.resources?.memoryUsage ?? 0)} / ${formatBytes(
                            systemStatus?.resources?.memoryTotal ?? 0
                        )}`}
                    />

                    <ResourceUsageItem
                        icon={<Storage color="action" />}
                        label="Disk Usage"
                        percentage={diskUsagePercent}
                        details={`${formatBytes(systemStatus?.resources?.diskUsage ?? 0)} / ${formatBytes(
                            systemStatus?.resources?.diskTotal ?? 0
                        )}`}
                    />
                </Paper>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Active Services
                    </Typography>
                    {/* {systemStatus?.services?.map((service) => (
            <Typography key={service.name}>
            {service.name}: {service.status}
            </Typography>
        ))} */}
                </Paper>
            </Grid>
        </Grid>
    );
};

export default Dashboard;
