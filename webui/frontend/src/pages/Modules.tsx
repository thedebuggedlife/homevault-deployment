import { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Grid } from '@mui/material';
import backend from '../backend';
import { SystemStatusResponse } from '@backend/types';
import ModulesList from '@/components/modules/ModulesList';

export default function Modules() {
    const [status, setStatus] = useState<SystemStatusResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedModule, setExpandedModule] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await backend.getStatus();
                setStatus(response);
            } catch (err) {
                setError('Failed to fetch system status');
                console.error('Error fetching system status:', err);
            }
        };

        fetchStatus();
    }, []);

    const handleModuleClick = (moduleName: string) => {
        setExpandedModule(prev => prev === moduleName ? null : moduleName);
    };

    if (error) {
        return (
            <Typography color="error" variant="h6">
                {error}
            </Typography>
        );
    }

    if (!status) {
        return <Typography>Loading...</Typography>;
    }

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
                <Card>
                    <CardContent>
                        <Typography variant="h5" gutterBottom>
                            Installed Modules
                        </Typography>
                        <ModulesList
                            modules={status.installedModules}
                            dockerContainers={status.dockerContainers}
                            expandedModule={expandedModule}
                            onModuleClick={handleModuleClick}
                        />
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
}