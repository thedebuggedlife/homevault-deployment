import React, { useEffect, useState } from "react";
import {
    Container,
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";
import {
    PhotoLibrary as PhotoLibraryIcon,
    Refresh as RefreshIcon,
} from "@mui/icons-material";
import backend from "@/backend";
import { BackupSnapshot } from "@backend/types/backup";
import SnapshotRow from "@/components/backup/snapshots/SnapshotRow";

const BackupSnapshots: React.FC = () => {
    const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedSnapshot, setSelectedSnapshot] = useState<BackupSnapshot | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchSnapshots();
    }, []);

    const fetchSnapshots = async () => {
        try {
            setLoading(true);
            const response = await backend.getBackupSnapshots();
            setSnapshots(response);
            setError("");
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
            await backend.deleteBackupSnapshot(selectedSnapshot.id);
            setDeleteDialogOpen(false);
            setSelectedSnapshot(null);
            // Refresh the list
            await fetchSnapshots();
        } catch (err) {
            console.error("Failed to delete snapshot:", err);
            alert("Failed to delete snapshot");
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setSelectedSnapshot(null);
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
        <Container maxWidth="lg">
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PhotoLibraryIcon color="primary" />
                        <Typography variant="h5">
                            Backup Snapshots
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchSnapshots}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </Box>

                {snapshots.length === 0 ? (
                    <Alert severity="info">
                        No snapshots found. Run a backup to create your first snapshot.
                    </Alert>
                ) : (
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
                )}

                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Total snapshots: {snapshots.length}
                    </Typography>
                </Box>
            </Paper>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleDeleteCancel}
                aria-labelledby="delete-dialog-title"
            >
                <DialogTitle id="delete-dialog-title">
                    Delete Snapshot?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete snapshot <strong>{selectedSnapshot?.shortId || selectedSnapshot?.id}</strong>?
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                    >
                        {deleting ? <CircularProgress size={20} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default BackupSnapshots;