import { Dialog, DialogContent, DialogTitle, DialogActions, IconButton, Typography, Button, Box, Alert } from "@mui/material";
import { useServerActivity } from "@/hooks/useServerActivity";
import { Close as CloseIcon } from "@mui/icons-material";
import { ServerActivity } from "@backend/types";
import { useMemo } from "react";
import { ConfirmOptions, useDialogs } from "@toolpad/core";
import Terminal from "./Terminal";
import _ from "lodash";

interface Props {
    activity?: ServerActivity;
    onClose?: () => void;
}

const OPERATION_DETAILS: Record<ServerActivity["type"], {title: string, subtitle: string}> = {
    "backup_init": {
        title: "Backup System Initialization",
        subtitle: "Initializing the backup repository and configuring storage settings...",
    },
    "backup_run": {
        title: "Creating a New Backup Snapshot",
        subtitle: "Creating a snapshot of your system data and storing it in the repository...",
    },
    "backup_update": {
        title: "Updating Backup Configuration",
        subtitle: "Applying changes to your backup configuration...",
    },
    "deployment": {
        title: "Running a Deployment",
        subtitle: "Modifying and configuring the modules installed on your server...",
    },
}

const DEFAULT_DETAILS = {
    title: "Operation in Progress",
    subtitle: "Processing your request...",
}

export default function ProgressDialog({ activity, onClose }: Props) {
    const { output, completed, error, abort } = useServerActivity(activity?.id);
    const terminalOutput = _.isEmpty(output) ? ["Waiting for output..."] : output;
    const { title, subtitle } = useMemo(() => OPERATION_DETAILS[activity?.type] ?? DEFAULT_DETAILS, [activity]);

    const { confirm } = useDialogs();
    const handleAbort = async () => {
        const message = <>
                <Typography component="p">
                    This will terminate the running process on the server.
                </Typography>
                <Typography component="p" sx={{marginTop: 2}}>
                    Do you want to continue?
                </Typography>
            </>
        const options: ConfirmOptions = {
            title: "Abort Operation",
            okText: "Abort",
            cancelText: "Cancel",
            severity: "error"
        };
        const result = await confirm(message, options);
        if (result) {
            abort();
        }
    }

    return (
        <Dialog maxWidth="md" fullWidth open={activity != null} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <IconButton
                aria-label="close"
                onClick={onClose}
                sx={(theme) => ({
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon />
            </IconButton>
            <DialogContent>
                {completed ? (
                    <Alert 
                        severity={error ? "error" : "info"}
                        sx={{ mb: 2 }}
                    >
                        {error ? (
                            <>
                                <Typography variant="subtitle2" gutterBottom>
                                    Operation Failed
                                </Typography>
                                <Typography variant="body2">
                                    {error}
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="subtitle2">
                                Operation completed!
                            </Typography>
                        )}
                    </Alert>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {subtitle}
                    </Typography>
                )}
                <Terminal output={terminalOutput} />
            </DialogContent>
            {!completed && (
                <DialogActions>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleAbort}
                    >
                        Abort Operation
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}