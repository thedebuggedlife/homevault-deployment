import * as React from 'react';
import { User } from '@/types';
import { createNanoEvents } from "nanoevents";
import backend from "@/backend";

export const restoreSession = async (): Promise<User|undefined> => {
    const token = localStorage.getItem("token");
    if (token) {
        try {
            const response = await backend.check(token);
            const user = { name: response.user.username };
            emitter.emit('authStateChanged', user);
            return user;
        } catch (error) {
            console.error("Failed to validate stored token", error);
        }
    }
    emitter.emit('authStateChanged', null);
}

export const signIn = async (username: string, password: string): Promise<User> => {
    try {
        const { token } = await backend.login(username, password);
        localStorage.setItem("token", token);
        const user = { name: username };
        emitter.emit('authStateChanged', user);
        return user;
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
};

export const signOut = async () => {
    localStorage.removeItem("token");
    await backend.logout();
    emitter.emit('authStateChanged', null);
};

const emitter = createNanoEvents();

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
    return emitter.on("authStateChanged", callback);
};


export interface Session {
  user: User;
}

interface SessionContextType {
  session: Session | null;
  setSession: (session: Session) => void;
  loading: boolean;
}

const SessionContext = React.createContext<SessionContextType>({
  session: null,
  setSession: () => {},
  loading: true,
});

export default SessionContext;

export const useSession = () => React.useContext(SessionContext);
