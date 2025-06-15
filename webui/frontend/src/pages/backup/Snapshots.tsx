import React, { useEffect, useState } from "react";
import {
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from "@mui/material";
import { Refresh as RefreshIcon, PlayArrow as PlayArrowIcon } from "@mui/icons-material";
import backend from "@/backend/backend";
import { BackupSnapshot } from "@backend/types/backup";
import SnapshotRow from "@/components/backup/snapshots/SnapshotRow";
import DeleteConfirmationDialog from "@/components/backup/snapshots/DeleteConfirmationDialog";
import BackupConfirmationDialog from "@/components/backup/snapshots/BackupConfirmationDialog";

const BackupSnapshots: React.FC = () => {
    const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [deleteError, setDeleteError] = useState<string>();
    const [deletedId, setDeletedId] = useState<string>();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedSnapshot, setSelectedSnapshot] = useState<BackupSnapshot | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [backupRunning, setBackupRunning] = useState(false);
    const [backupError, setBackupError] = useState<string>();
    const [backupSuccess, setBackupSuccess] = useState(false);

    useEffect(() => {
        fetchSnapshots();
    }, []);

    const fetchSnapshots = async () => {
        try {
            setLoading(true);
            const response = await backend.getBackupSnapshots();
            setSnapshots(response);
            setError(null);
        } catch (err) {
            setError("Failed to load snapshots");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (snapshot: BackupSnapshot) => {
        setSelectedSnapshot(snapshot);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedSnapshot) return;

        try {
            setDeleting(true);
            setDeleteError(null);
            await backend.deleteBackupSnapshot(selectedSnapshot.id);
            setDeletedId(selectedSnapshot.shortId ?? selectedSnapshot.id);
            fetchSnapshots();
        } catch (error) {
            let message = "Failed to delete snapshot.";
            if (error.message) {
                message += " " + error.message;
            }
            setDeleteError(message);
        } finally {
            setDeleteDialogOpen(false);
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        if (!deleting) {
            setDeleteDialogOpen(false);
            setSelectedSnapshot(null);
        }
    };

    const handleRunBackup = async () => {
        setBackupError(null);
        setBackupSuccess(false);
        setConfirmDialogOpen(true);
    };

    const handleConfirmBackup = async (keepForever: boolean) => {
        try {
            setConfirmDialogOpen(false);
            setBackupRunning(true);
            await backend.startBackup(keepForever);
            setBackupSuccess(true);
            fetchSnapshots(); // Refresh the snapshots list after backup
        } catch (error) {
            setBackupError("Backup operation failed. " + (error.message ?? ""));
        } finally {
            setBackupRunning(false);
        }
    };

    const handleCancelBackup = () => {
        setConfirmDialogOpen(false);
    };

    if (loading && snapshots.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error && snapshots.length === 0) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
                <Button onClick={fetchSnapshots} sx={{ ml: 2 }}>
                    Retry
                </Button>
            </Alert>
        );
    }

    return (
        <>
            <Box sx={{ display: "flex", justifyContent: "end", gap: 2, mb: 3 }}>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchSnapshots}
                    loading={loading}
                    loadingPosition="start"
                >
                    Refresh
                </Button>
                <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleRunBackup}
                    color="primary"
                    loading={backupRunning}
                    loadingPosition="start"
                >
                    Run Backup Now
                </Button>
            </Box>

            {backupError && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setBackupError(null)}>
                    {backupError}
                </Alert>
            )}

            {backupSuccess && (
                <Alert severity="success" sx={{ m: 2 }} onClose={() => setBackupSuccess(false)}>
                    Backup completed successfully. The snapshots list has been refreshed.
                </Alert>
            )}

            {deleteError && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setDeleteError(null)}>
                    {deleteError}
                </Alert>
            )}

            {deletedId && (
                <Alert severity="success" sx={{ m: 2 }} onClose={() => setDeletedId(null)}>
                    Snapshot <strong>{deletedId}</strong> was deleted successfully.
                </Alert>
            )}

            {snapshots.length === 0 ? (
                <Alert severity="info" sx={{ m: 2 }}>
                    No snapshots found. Run a backup to create your first snapshot.
                </Alert>
            ) : (
                <Paper sx={{ p: 3 }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Snapshot ID</TableCell>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Hostname</TableCell>
                                    <TableCell>Tags</TableCell>
                                    <TableCell>Size</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {snapshots.map((snapshot) => (
                                    <SnapshotRow snapshot={snapshot} onDelete={() => handleDeleteClick(snapshot)} />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Total snapshots: {snapshots.length}
                        </Typography>
                    </Box>
                </Paper>
            )}

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteDialogOpen}
                deleting={deleting}
                onClose={handleDeleteCancel}
                onDelete={handleDeleteConfirm}
                selectedSnapshot={selectedSnapshot}
            />

            {/* Backup Confirmation Dialog */}
            <BackupConfirmationDialog
                open={confirmDialogOpen}
                onClose={handleCancelBackup}
                onConfirm={handleConfirmBackup}
            />
        </>
    );
};

export default BackupSnapshots;
