import * as React from 'react';
import { User } from '@/types';
import { createNanoEvents } from "nanoevents";
import backend from "@/backend";

let refreshTimeout: number;

function scheduleRefresh(expiresInSec: number) {
    if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
    }
    const timeoutInMs = (expiresInSec / 2) * 1000;
    console.debug("Refreshing token in " + timeoutInMs);
    refreshTimeout = window.setTimeout(refreshSession, timeoutInMs);
}

async function refreshSession() {
    const token = localStorage.getItem("token");
    if (token) {
        try {
            const response = await backend.refreshToken(token);
            localStorage.setItem("token", response.token);
            scheduleRefresh(response.expiresInSec);
        } catch (error) {
            console.error("Failed to refresh token", error);
            if ([401, 403].includes(error.status)) {
                signOut();
            } else {
                // Retry in a minute
                scheduleRefresh(60);
            }
        }
    }
}

export const restoreSession = async (): Promise<User|undefined> => {
    const token = localStorage.getItem("token");
    if (token) {
        try {
            const response = await backend.refreshToken(token);
            scheduleRefresh(response.expiresInSec)
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
        const { token, expiresInSec } = await backend.login(username, password);
        localStorage.setItem("token", token);
        scheduleRefresh(expiresInSec);
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
