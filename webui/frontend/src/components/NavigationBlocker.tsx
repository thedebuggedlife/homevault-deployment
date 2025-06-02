import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
} from '@mui/material';

interface NavigationBlockerProps {
    when?: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export function NavigationBlocker({
    when = true,
    title = 'Confirm Navigation',
    message,
    confirmText = 'Leave',
    cancelText = 'Stay',
    onConfirm,
    onCancel,
}: NavigationBlockerProps) {
    // Note: useBlocker is available in react-router-dom v6.4+
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => 
            when && currentLocation.pathname !== nextLocation.pathname
    );

    // Handle browser navigation (refresh, close tab)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (when) {
                e.preventDefault();
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [when, message]);

    const handleConfirm = useCallback(() => {
        onConfirm?.();
        blocker.proceed?.();
    }, [blocker, onConfirm]);

    const handleCancel = useCallback(() => {
        onCancel?.();
        blocker.reset?.();
    }, [blocker, onCancel]);

    return (
        <Dialog
            open={blocker.state === 'blocked'}
            onClose={handleCancel}
            aria-labelledby="navigation-dialog-title"
            aria-describedby="navigation-dialog-description"
        >
            <DialogTitle id="navigation-dialog-title">
                {title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="navigation-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} color="primary">
                    {cancelText}
                </Button>
                <Button onClick={handleConfirm} color="error" autoFocus>
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}