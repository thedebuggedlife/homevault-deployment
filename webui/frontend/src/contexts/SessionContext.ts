import { createContext, useContext } from 'react';
import { Session } from './SessionProvider';

export interface SessionContextType {
    session?: Session,
    loading: boolean,
    signIn: (username: string, password: string) => Promise<void>,
    signOut: () => Promise<void>,
    restore: () => Promise<void>
}

const defaultContext: SessionContextType = {
    loading: false,
    signIn: async () => {},
    signOut: async () => {},
    restore: async () => {},
};

export function useSession() {
    return useContext(SessionContext);
}

export const SessionContext = createContext<SessionContextType>(defaultContext);