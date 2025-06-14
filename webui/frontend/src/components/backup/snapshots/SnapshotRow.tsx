import { formatBytes, formatDate } from "@/utils/units";
import { BackupSnapshot } from "@backend/types/backup";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { TableRow, TableCell, Typography, Box, Chip, IconButton } from "@mui/material";

export interface SnapshotRowProps {
    snapshot: BackupSnapshot;
    onDelete: () => void;
}

export default function SnapshotRow({ snapshot, onDelete }: SnapshotRowProps) {
    console.log(snapshot.id);
    return (
        <TableRow key={snapshot.id}>
            <TableCell>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {snapshot.shortId || snapshot.id}
                </Typography>
            </TableCell>
            <TableCell>{formatDate(snapshot.time)}</TableCell>
            <TableCell>{snapshot.hostname}</TableCell>
            <TableCell>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {snapshot.tags.map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                        />
                    ))}
                </Box>
            </TableCell>
            <TableCell>{formatBytes(snapshot.totalSize)}</TableCell>
            <TableCell align="right">
                <IconButton
                    color="error"
                    onClick={onDelete}
                    size="small"
                >
                    <DeleteIcon />
                </IconButton>
            </TableCell>
        </TableRow>
    )
}