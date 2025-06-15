import React, { useEffect, useState } from "react";
import { Container, Box, CircularProgress, Alert } from "@mui/material";
import { SystemStatusResponse } from "@backend/types";
import backend from "@/backend/backend";
import BackupStatusOverview from "@/components/dashboard/BackupStatusOverview";
import ResourceUsage from "@/components/dashboard/ResourceUsage";
import SystemOverview from "@/components/dashboard/SystemOverview";

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

    return (
        <>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, 1fr)",
                    },
                    gap: 3,
                    gridAutoFlow: "dense",
                    alignItems: "start",
                }}
            >
                {/* System Overview */}
                <SystemOverview
                    version={systemStatus?.version}
                    installedModules={systemStatus?.installedModules}
                    dockerContainers={systemStatus?.dockerContainers}
                />

                {/* Resource Usage */}
                <ResourceUsage resources={systemStatus?.resources} />

                {/* Backup Status */}
                <BackupStatusOverview />
            </Box>
        </>
    );
};

export default Dashboard;
