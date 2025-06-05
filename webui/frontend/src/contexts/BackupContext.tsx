import { BackupStatus } from '@backend/types/backup';
import { createContext } from 'react';

interface BackupContextType {
    loading: boolean;
    status?: BackupStatus;
    error?: string;
    reload: () => void;
}

export const BackupContext = createContext<BackupContextType>({ loading: false, reload: () => {} });


