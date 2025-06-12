import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import Terminal from "./Terminal";
import _ from "lodash";
import { useServerActivity } from "@/hooks/useServerActivity";
import { Close as CloseIcon } from "@mui/icons-material";

interface Props {
    open: boolean;
    activityId?: string;
    onClose?: () => void;
}

export default function ProgressDialog({ activityId, open, onClose }: Props) {
    const { output } = useServerActivity(activityId);
    const terminalOutput = _.isEmpty(output) ? ["Waiting for output..."] : output;

    return (
        <Dialog maxWidth="md" fullWidth open={open} onClose={onClose}>
            <DialogTitle>Operation Progress</DialogTitle>
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
                <Terminal output={terminalOutput} />
            </DialogContent>
        </Dialog>
    );
}
