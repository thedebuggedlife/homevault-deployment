import { DockerContainer } from "@backend/types";
import { Computer } from "@mui/icons-material";
import { Paper, Box, Typography, Divider } from "@mui/material";

export default function SystemOverview({
    version,
    installedModules,
    dockerContainers,
}: {
    version: string;
    installedModules: string[];
    dockerContainers: DockerContainer[];
}) {
    return (
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
                        {version || "Unknown"}
                    </Typography>
                </Box>

                <Divider />

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" color="primary" fontWeight="bold">
                            {installedModules?.length || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Installed Modules
                        </Typography>
                    </Box>

                    <Divider orientation="vertical" flexItem />

                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h4" color="primary" fontWeight="bold">
                            {dockerContainers?.length || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Docker Containers
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
}
