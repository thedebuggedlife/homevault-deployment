import * as React from 'react';
import { 
  Dashboard as DashboardIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { AppProvider } from '@toolpad/core/AppProvider';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Authentication, Navigation, Router } from '@toolpad/core';
import SessionContext, { type Session, onAuthStateChanged, restoreSession, signOut } from './contexts/SessionContext';
import { User } from './types';

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Navigation',
  },
  {
    title: 'Dashboard',
    segment: 'dashboard',
    icon: <DashboardIcon />,
  },
  {
    title: 'Modules',
    segment: 'modules',
    icon: <ExtensionIcon />,
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
  
  // Get React Router hooks
  const location = useLocation();
  const navigate = useNavigate();

  // Create router adapter for Toolpad
  const router = React.useMemo<Router>(() => {
    return {
      pathname: location.pathname,
      searchParams: new URLSearchParams(location.search),
      navigate: (path: string | URL) => navigate(String(path)),
    };
  }, [location, navigate]);

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
    <AppProvider 
      navigation={NAVIGATION} 
      branding={BRANDING}
      session={session}
      authentication={AUTHENTICATION}
      router={router}
    >
      <SessionContext.Provider value={sessionContextValue}>
        <Outlet />
      </SessionContext.Provider>
    </AppProvider>
  );
}