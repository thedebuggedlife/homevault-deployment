import { ReactNode } from "react";
import { BackupContext } from "./BackupContext";
import { useBackupStatus } from "@/hooks/useBackupStatus";

export function BackupProvider({ children }: { children: ReactNode; }) {
    const { loading, status, error, reload } = useBackupStatus();

    return (
        <BackupContext.Provider value={{loading, status, error, reload}}>
            {children}
        </BackupContext.Provider>
    );
}
