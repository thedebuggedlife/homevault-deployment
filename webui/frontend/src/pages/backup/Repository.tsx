import React, { useContext, useState, useCallback, useEffect } from "react";
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
    Divider,
    IconButton,
} from "@mui/material";
import {
    Cached as CachedIcon,
    Backup as BackupIcon,
    Edit as EditIcon,
    Star as StarIcon,
    Add as AddIcon,
    Save as SaveIcon,
    Undo as UndoIcon,
} from "@mui/icons-material";
import { BackupContext } from "@/contexts/BackupContext";
import S3Repository from "@/components/backup/repository/S3Repository";
import B2Repository from "@/components/backup/repository/B2Repository";
import RESTRepository from "@/components/backup/repository/RESTRepository";
import GoogleCloudRepository from "@/components/backup/repository/GoogleCloudRepository";
import AzureRepository from "@/components/backup/repository/AzureRepository";
import LocalRepository from "@/components/backup/repository/LocalRepository";
import SFTPRepository from "@/components/backup/repository/SFTPRepository";
import backend from "@/backend/backend";
import { RepositoryCredentials, ResticRepository } from "@backend/types/restic";
import SecretField from "@/components/SecretField";
import _ from "lodash";
import { useDialogs } from "@toolpad/core";
import RepositoryTypeDialog from "@/components/backup/repository/RepositoryTypeDialog";
import { createEmptyRepository } from "@/utils/restic";

const BackupRepository: React.FC = () => {
    const dialogs = useDialogs();
    const { status, loading, error, reload } = useContext(BackupContext);
    const [editMode, setEditMode] = useState(false);
    const [repository, setRepository] = useState<ResticRepository | null>(null);
    const [originalRepository, setOriginalRepository] = useState<ResticRepository | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string>();
    const [allTouched, setAllTouched] = useState(false);
    const [detailsValid, setDetailsValid] = useState(false);

    useEffect(() => {
        if (status?.repository) {
            setRepository(_.cloneDeep(status.repository)); // Deep clone
            setOriginalRepository(_.cloneDeep(status.repository));
        }
    }, [status?.repository]);

    const hasChanges = !_.isEqual(repository, originalRepository);

    const handleEdit = () => {
        setEditMode(true);
        setSaveError(undefined);
        setAllTouched(false);
    };

    const handleNew = async () => {
        const repositoryType = await dialogs.open(RepositoryTypeDialog, null);
        if (repositoryType && repositoryType !== "unknown") {
            setRepository(createEmptyRepository(repositoryType));
            handleEdit();
        }
    }

    const handleCancel = () => {
        setEditMode(false);
        setRepository(_.cloneDeep(originalRepository)); // Reset to original
        setSaveError(undefined);
        setAllTouched(false);
    };

    const handleSave = useCallback(async () => {
        if (!repository) return;
        
        if (!detailsValid) {
            setAllTouched(true);
            return;
        }
        
        try {
            setSaveError(undefined);
            setSaving(true);
            await backend.initBackupRepository({ repository });
            await reload();
            setOriginalRepository(_.cloneDeep(repository));
            setEditMode(false);
            setAllTouched(false);
        } catch (error) {
            console.error("Failed to save repository:", error);
            let message = "Failed to save repository configuration";
            if (error.message) {
                message += ": " + error.message;
            }
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }, [repository, detailsValid, reload]);

    const handleDetailsChange = useCallback((details: ResticRepository["details"]) => {
        if (!repository) return;
        
        const newRepository = _.cloneDeep(repository);
        newRepository.details = details;
        newRepository.location = generateRepositoryLocation(newRepository);
        setRepository(newRepository);
    }, [repository]);

    const handleCredentialsChange = useCallback((details: RepositoryCredentials["details"]) => {
        if (!repository) return;
        
        const newRepository = _.cloneDeep(repository);
        newRepository.credentials = { ...newRepository.credentials, details };
        setRepository(newRepository);
    }, [repository]);

    const handlePasswordChange = useCallback((resticPassword: string) => {
        const newRepository = _.cloneDeep(repository);
        newRepository.credentials = { ...newRepository.credentials, resticPassword };
        setRepository(newRepository);
    }, [repository])

    const handleValidation = useCallback((isValid: boolean) => {
        setDetailsValid(isValid);
    }, []);

    const generateRepositoryLocation = (repo: ResticRepository): string => {
        switch (repo.repositoryType) {
            case "s3":
                return `s3:${repo.details.endpoint || ''}/${repo.details.bucket}${repo.details.path}`;
            case "b2":
                return `b2:${repo.details.bucket}${repo.details.path}`;
            case "rest":
                return `rest:${repo.details.url}`;
            case "azure":
                return `azure:${repo.details.containerName}:${repo.details.path}`;
            case "gs":
                return `gs:${repo.details.bucket}${repo.details.path}`;
            case "sftp":
                return `sftp:${repo.details.username ? repo.details.username + '@' : ''}${repo.details.host}:${repo.details.port || 22}${repo.details.path}`;
            case "local":
                return repo.details.path;
        }
    };

    const renderRepositoryDetails = () => {
        if (!repository) return null;

        switch (repository.repositoryType) {
            case "s3":
                return (
                    <S3Repository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "b2":
                return (
                    <B2Repository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "rest":
                return (
                    <RESTRepository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "gs":
                return (
                    <GoogleCloudRepository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "azure":
                return (
                    <AzureRepository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "sftp":
                return (
                    <SFTPRepository
                        details={repository.details}
                        credentials={repository.credentials?.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onCredentialsChange={handleCredentialsChange}
                        onValidation={handleValidation}
                    />
                );
            case "local":
                return (
                    <LocalRepository
                        details={repository.details}
                        editMode={editMode}
                        allTouched={allTouched}
                        onDetailsChange={handleDetailsChange}
                        onValidation={handleValidation}
                    />
                );
        }
    };

    if (loading && !saving) {
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

    if (!status?.initialized && !editMode) {
        return (
            <Container maxWidth="md">
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <BackupIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
                    <Typography variant="h5" gutterBottom>
                        Configure Backup Repository
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        A backup repository stores all your snapshots. Choose a storage backend and configure it to get started.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleNew}
                        size="large"
                    >
                        Initialize Repository
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <>
            {saveError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {saveError}
                </Alert>
            )}
            <Box sx={{ display: "flex", justifyContent: "end", gap: 2, mb: 3 }}>
                {!editMode && (
                    <IconButton onClick={reload} color="primary">
                        <CachedIcon />
                    </IconButton>
                )}
                {editMode && !saving && (
                    <Button
                        variant="outlined"
                        startIcon={<UndoIcon />}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                )}
                {editMode ? (
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        loading={saving}
                        loadingPosition="start"
                        disabled={!hasChanges}
                    >
                        Save
                    </Button>
                ) : (
                    <>
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleEdit}
                        >
                            Edit Config
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<StarIcon />}
                            onClick={handleNew}
                        >
                            Create New
                        </Button>
                    </>
                )}
            </Box>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Repository Type: {repository?.repositoryType || status?.repository?.repositoryType}
                    </Typography>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Repository Location
                        </Typography>
                        <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
                            {repository?.location || status?.repository?.location}
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    { status?.initialized && editMode && (
                        <Alert severity="info" sx={{ m: 2, mb: 3 }}>
                            <Typography variant="body2">
                                <strong>Note:</strong> Changing repository configuration may affect access to existing snapshots.
                            </Typography>
                        </Alert>
                    )}

                    {renderRepositoryDetails()}

                    <Divider sx={{ my: 2 }} />

                    <Box>
                        { editMode && (
                            <Alert severity="warning" sx={{ m: 2, mb: 3 }}>
                                <Typography variant="body2">
                                    Keep your password in a safe location. If you lose it, your backup data will become <strong>permanently and irreversibly inaccessible</strong>.
                                </Typography>
                            </Alert>
                        )}
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Repository Password
                        </Typography>
                        <SecretField
                            value={repository?.credentials?.resticPassword ?? ""}
                            fullWidth
                            disabled={!editMode}
                            variant="outlined"
                            isSet={repository?.passwordSet} 
                            onChange={handlePasswordChange} 
                            validate={allTouched}
                        />
                    </Box>
                </CardContent>
            </Card>
        </>
    );
};

export default BackupRepository;