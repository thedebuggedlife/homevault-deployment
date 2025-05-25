import * as React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { Outlet } from 'react-router';
import type { Authentication, Navigation } from '@toolpad/core';
import SessionContext, { type Session, onAuthStateChanged, restoreSession, signOut } from './contexts/SessionContext';
import { User } from './types';

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Navigation',
  },
  {
    title: 'Dashboard',
    icon: <DashboardIcon />,
  },
];

const BRANDING = {
  title: 'HomeVault',
};

const AUTHENTICATION: Authentication = {
  signIn: () => {},
  signOut: signOut,
};

export default function App() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  const sessionContextValue = React.useMemo(
    () => ({
      session,
      setSession,
      loading,
    }),
    [session, loading],
  );

  React.useEffect(() => {
    // Returns an `unsubscribe` function to be called during teardown
    const unsubscribe = onAuthStateChanged((user: User | null) => {
      if (user) {
        setSession({ user });
      } else {
        setSession(null);
      }
      setLoading(false);
    });
    restoreSession();
    return () => unsubscribe();
  }, []);
  
  return (
    <ReactRouterAppProvider 
      navigation={NAVIGATION} 
      branding={BRANDING}
      session={session}
      authentication={AUTHENTICATION}
    >
      <SessionContext.Provider value={sessionContextValue}>
        <Outlet />
      </SessionContext.Provider>
    </ReactRouterAppProvider>
  );
}
