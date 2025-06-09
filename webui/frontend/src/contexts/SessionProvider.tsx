import { User } from '@/types';
import backend, { SessionSocket } from "@/backend/backend";
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { SessionContext, SessionContextType } from './SessionContext';
import { useDialogs } from '@toolpad/core';
import PasswordDialog from '@/components/PasswordDialog';

export interface Session {
    user: User;
    token: string;
}

export const SessionProvider = ({ children }: { children: ReactNode; }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef(null)
    const connection = useRef<SessionSocket>(null);
    const dialogs = useDialogs();

    const disconnect = () => {
        if (connection.current) {
            connection.current.disconnect();
            connection.current = null;
        }
    }

    const clearTimeout = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }

    const refreshSession = async () => {
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const response = await backend.refreshToken(token);
                localStorage.setItem("token", response.token);
                scheduleRefresh(response.expiresInSec);
                setSession(prev => ({ ...prev, token: response.token }));
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
    };

    const scheduleRefresh = (expiresInSec: number) => {
        clearTimeout();
        const timeoutInMs = (expiresInSec / 2) * 1000;
        console.debug("Refreshing token in " + timeoutInMs);
        timeoutRef.current = window.setTimeout(refreshSession, timeoutInMs);
    };

    const signIn = useCallback(async (username: string, password: string) => {
        try {
            const { token, expiresInSec } = await backend.login(username, password);
            localStorage.setItem("token", token);
            scheduleRefresh(expiresInSec);
            const user = { name: username };
            setSession({ user, token });
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signOut = useCallback(async () => {
        localStorage.removeItem("token");
        setSession(null);
        await backend.logout();
        disconnect();
    }, []);
    
    const restoreSession = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            if (token) {
                    const response = await backend.refreshToken(token);
                scheduleRefresh(response.expiresInSec)
                const user = { name: response.user.username };
                setSession({ user, token });
            }
        } catch (error) {
            console.error("Failed to validate stored token", error);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Component initialization and cleanup
    useEffect(() => {
        restoreSession();
        return () => {
            clearTimeout();
            disconnect();
        };
    }, [restoreSession]);

    // Handle auth state changes
    useEffect(() => {
        disconnect();
        if (session?.user) {
            connection.current = backend.connectSession();
            connection.current.on("sudo", async (request, cb) => {
                console.warn("Sudo credentials requested", request);
                const password = await dialogs.open(PasswordDialog, request);
                cb({ password });
            })
        }
    }, [dialogs, session?.user]);

    // Update socket auth when token is refreshed
    useEffect(() => {
        if (connection.current && session?.token) {
            connection.current.auth = { ...connection.current.auth, token: session.token };
        }
    }, [session?.token]);

    const sessionContext: SessionContextType = {
        session,
        loading,
        signIn,
        signOut,
        restore: restoreSession,
    }

    return (
        <SessionContext.Provider value={sessionContext}>
            {children}
        </SessionContext.Provider>
    );
};