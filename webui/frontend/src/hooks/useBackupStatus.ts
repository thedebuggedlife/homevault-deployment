import { useState, useEffect, useCallback } from 'react';
import backend from '@/backend';
import { BackupStatus } from '@backend/types/backup';
import { useSession } from '@/contexts/SessionContext';

export function useBackupStatus() {
    const { session } = useSession();
    const [status, setStatus] = useState<BackupStatus>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>(null);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            setStatus(await backend.getBackupStatus());
        } catch (error) {
            let message = "Failed to load backup status."
            if (error.message) {
                message += " " + error.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session) {
            loadConfig();
        }
    }, [loadConfig, session]);

    return { status, setStatus, loading, error, reload: loadConfig };
}