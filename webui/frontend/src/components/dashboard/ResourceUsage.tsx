import { formatBytes } from "@/utils/units";
import { Speed, Memory, Storage } from "@mui/icons-material";
import { Paper, Typography } from "@mui/material";
import ResourceUsageItem from "./ResourceUsageItem";
import { SystemResources } from "@backend/types";
import { useMemo } from "react";

export default function ResourceUsage({
    resources
}: {
    resources: SystemResources
}) {
    const memoryUsage = useMemo(() => {
        if (resources?.memoryTotal && resources?.memoryUsage) {
            return (resources.memoryUsage / resources.memoryTotal) * 100;
        }
        return 0;
    }, [resources]);

    const diskUsage = useMemo(() => {
        if (resources?.diskTotal && resources?.diskUsage) {
            return (resources.diskUsage / resources.diskTotal) * 100;
        }
        return 0;
    }, [resources]);

    return (
        <Paper 
            sx={{ 
                p: 3,
                gridRow: {
                    xs: "auto",
                    md: "span 2",
                },
            }}
        >
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Resource Usage
            </Typography>

            <ResourceUsageItem icon={<Speed color="action" />} label="CPU Usage" percentage={resources.cpuLoad} />

            <ResourceUsageItem
                icon={<Memory color="action" />}
                label="Memory Usage"
                percentage={memoryUsage}
                details={`${formatBytes(resources.memoryUsage ?? 0)} / ${formatBytes(
                    resources.memoryTotal ?? 0
                )}`}
            />

            <ResourceUsageItem
                icon={<Storage color="action" />}
                label="Disk Usage"
                percentage={diskUsage}
                details={`${formatBytes(resources.diskUsage ?? 0)} / ${formatBytes(
                    resources.diskTotal ?? 0
                )}`}
            />
        </Paper>
        );
}