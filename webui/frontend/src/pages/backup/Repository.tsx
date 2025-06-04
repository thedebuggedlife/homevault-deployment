import React, { useEffect, useState } from "react";
import {
    Container,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Button,
    Card,
    CardContent,
    TextField,
    Grid,
    Divider,
} from "@mui/material";
import {
    Storage as StorageIcon,
    Edit as EditIcon,
    Add as AddIcon,
} from "@mui/icons-material";
import backend from "@/backend";
import { BackupConfig, BackupStatus } from "@/types/backup";

const BackupRepository: React.FC = () => {
    const [status, setStatus] = useState<BackupStatus | null>(null);
    const [config, setConfig] = useState<BackupConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statusRes, configRes] = await Promise.all([
                backend.getBackupStatus(),
                backend.getBackupConfig(),
            ]);
            setStatus(statusRes);
            setConfig(configRes);
            setError("");
        } catch (err) {
            setError("Failed to load repository configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleInitialize = () => {
        // TODO: Open repository wizard
        alert("Repository wizard not yet implemented");
    };

    const handleEdit = () => {
        setEditMode(true);
        // TODO: Implement edit mode
        alert("Edit functionality not yet implemented");
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
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!status?.initialized) {
        return (
            <Container maxWidth="md">
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <StorageIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
                    <Typography variant="h5" gutterBottom>
                        Configure Backup Repository
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        A backup repository stores all your snapshots. Choose a storage backend and configure it to get started.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleInitialize}
                        size="large"
                    >
                        Initialize Repository
                    </Button>
                </Paper>
            </Container>
        );
    }

    const renderRepositoryDetails = () => {
        if (!config) return null;

        switch (status?.repositoryType) {
            case "s3":
                return (
                    <>
                        <Grid container spacing={2}>
                            <Grid size={6}>
                                <TextField
                                    label="Endpoint"
                                    value={config.s3?.endpoint || ""}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Bucket"
                                    value={config.s3?.bucket || ""}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label="Path"
                                    value={config.s3?.path || "/"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Access Key"
                                    value={config.s3?.accessKeySet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Secret Key"
                                    value={config.s3?.secretKeySet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                        </Grid>
                    </>
                );
            case "b2":
                return (
                    <>
                        <Grid container spacing={2}>
                            <Grid size={6}>
                                <TextField
                                    label="Bucket"
                                    value={config.b2?.bucket || ""}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Path"
                                    value={config.b2?.path || "/"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Account ID"
                                    value={config.b2?.accountIdSet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Account Key"
                                    value={config.b2?.accountKeySet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                        </Grid>
                    </>
                );
            case "rest":
                return (
                    <>
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                <TextField
                                    label="REST Server URL"
                                    value={config.rest?.url || ""}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Username"
                                    value={config.rest?.usernameSet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                            <Grid size={6}>
                                <TextField
                                    label="Password"
                                    value={config.rest?.passwordSet ? "••••••••" : "Not Set"}
                                    fullWidth
                                    disabled
                                    variant="outlined"
                                />
                            </Grid>
                        </Grid>
                    </>
                );
            case "local":
            default:
                return (
                    <TextField
                        label="Repository Path"
                        value={config.repository || ""}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                );
        }
    };

    return (
        <Container maxWidth="md">
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Typography variant="h5">
                        Repository Configuration
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={handleEdit}
                        disabled={editMode}
                    >
                        Edit Configuration
                    </Button>
                </Box>

                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Repository Type: {status?.repositoryType?.toUpperCase()}
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Repository Location
                            </Typography>
                            <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
                                {config?.repository}
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        {renderRepositoryDetails()}

                        <Divider sx={{ my: 2 }} />

                        <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Repository Password
                            </Typography>
                            <TextField
                                value={config?.passwordSet ? "••••••••••••" : "Not Set"}
                                fullWidth
                                disabled
                                variant="outlined"
                                size="small"
                            />
                        </Box>
                    </CardContent>
                </Card>

                <Alert severity="info" sx={{ mt: 3 }}>
                    <Typography variant="body2">
                        <strong>Note:</strong> Changing repository configuration requires re-initialization. 
                        This will create a new repository and existing snapshots will not be accessible.
                    </Typography>
                </Alert>
            </Paper>
        </Container>
    );
};

export default BackupRepository;