import { BackupStatus } from '@backend/types/backup';
import { createContext } from 'react';

interface BackupContextType {
    loading: boolean;
    status?: BackupStatus;
    setStatus: (status: BackupStatus) => void;
    error?: string;
    reload: () => Promise<void>;
}

export const BackupContext = createContext<BackupContextType>({ loading: false, reload: async () => {}, setStatus: () => {} });


