import { BackupSnapshot } from "@backend/types/backup";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    CircularProgress,
} from "@mui/material";

export default function DeleteConfirmationDialog({
    open,
    deleting,
    onClose,
    onDelete,
    selectedSnapshot,
}: {
    open: boolean;
    deleting: boolean;
    onClose: () => void;
    onDelete: () => void;
    selectedSnapshot: BackupSnapshot;
}) {
    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="delete-dialog-title">
            <DialogTitle id="delete-dialog-title">Delete Snapshot?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Are you sure you want to delete snapshot{" "}
                    <strong>{selectedSnapshot?.shortId || selectedSnapshot?.id}</strong>? This action cannot be undone.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={deleting}>
                    Cancel
                </Button>
                <Button onClick={onDelete} color="error" variant="contained" disabled={deleting}>
                    {deleting ? <CircularProgress size={20} /> : "Delete"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
