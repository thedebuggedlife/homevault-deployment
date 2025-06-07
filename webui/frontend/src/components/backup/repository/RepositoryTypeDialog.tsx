import { RepositoryType } from "@backend/types/restic";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { DialogProps } from "@toolpad/core";
import _ from "lodash";
import { useEffect, useState } from "react";

// Repository type options for the dropdown
const REPOSITORY_TYPES: { value: RepositoryType; label: string; description: string }[] = [
    { value: "local", label: "Local", description: "Store backups on local filesystem" },
    { value: "s3", label: "S3 Compatible", description: "Store backups in AWS S3 or S3-compatible storage" },
    { value: "b2", label: "Backblaze B2", description: "Store backups in Backblaze B2 cloud storage" },
    { value: "rest", label: "REST Server", description: "Store backups on a REST server" },
    { value: "sftp", label: "SFTP", description: "Store backups on an SFTP server" },
    { value: "azure", label: "Azure Blob", description: "Store backups in Azure Blob Storage" },
    { value: "gs", label: "Google Cloud", description: "Store backups in Google Cloud Storage" },
];

export default function RepositoryTypeDialog(props: DialogProps<RepositoryType|null, RepositoryType|null>) {
    const { payload, open, onClose } = props;
    const [result, setResult] = useState<RepositoryType>("unknown");
    const createDisabled = _.isEmpty(result) || result === "unknown";
    
    useEffect(() => {
        if (payload) {
            setResult(payload);
        }
    }, [payload]);

    const handleChange = (value: RepositoryType) => {
        console.log("Changing value: " + value);
        setResult(value);
    }

    return (
        <Dialog
            open={open}
            onClose={() => onClose(null)}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Choose Repository Type</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Select the type of storage backend you want to use for your backup repository.
                </Typography>
                <FormControl fullWidth>
                    <InputLabel id="repository-type-label">Repository Type</InputLabel>
                    <Select
                        labelId="repository-type-label"
                        value={result}
                        label="Repository Type"
                        onChange={(ev) => handleChange(ev.target.value)}
                    >
                        { result === "unknown" && (
                            <MenuItem key="unknown" value="unknown" />
                        )}
                        {REPOSITORY_TYPES.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                                <Box>
                                    <Typography variant="body1">{type.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {type.description}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(null)}>Cancel</Button>
                <Button onClick={() => onClose(result)} variant="contained" disabled={createDisabled}>
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    );
}