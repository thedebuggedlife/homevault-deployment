import React, { useContext, useState } from "react";
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
    Divider,
} from "@mui/material";
import {
    Storage as StorageIcon,
    Edit as EditIcon,
    Add as AddIcon,
} from "@mui/icons-material";
import { BackupContext } from "@/contexts/BackupContext";
import S3Repository from "@/components/backup/repository/S3Repository";
import B2Repository from "@/components/backup/repository/B2Repository";
import RESTRepository from "@/components/backup/repository/RESTRepository";

const BackupRepository: React.FC = () => {
    const { status, loading, error, reload } = useContext(BackupContext);
    const [editMode, setEditMode] = useState(false);

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
                <Button onClick={reload} sx={{ ml: 2 }}>
                    Retry
                </Button>
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
        switch (status?.repository?.repositoryType) {
            case "s3":
                return <S3Repository repository={status.repository} />
            case "b2":
                return <B2Repository repository={status.repository} />
            case "rest":
                return <RESTRepository repository={status.repository} />
            default:
                return (
                    <TextField
                        label="Repository Path"
                        value={status?.repository?.location ?? ""}
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
                            Repository Type: {status?.repository?.repositoryType}
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Repository Location
                            </Typography>
                            <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
                                {status?.repository?.location}
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
                                value={status?.repository?.passwordSet ? "••••••••••••" : "Not Set"}
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