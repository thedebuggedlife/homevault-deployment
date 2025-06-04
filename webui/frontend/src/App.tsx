import * as React from 'react';
import { 
  Bookmark as BookmarkIcon,
  Dashboard as DashboardIcon,
  Extension as ExtensionIcon,
  Backup as BackupIcon,
  Schedule as ScheduleIcon,
  PhotoLibrary as PhotoLibraryIcon,
} from '@mui/icons-material';
import { AppProvider } from '@toolpad/core/AppProvider';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Authentication, Navigation, Router } from '@toolpad/core';
import SessionContext, { type Session, onAuthStateChanged, restoreSession, signOut } from './contexts/SessionContext';
import { DeploymentProvider } from './contexts/DeploymentProvider';
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
  {
    title: 'Backup',
    segment: 'backup',
    icon: <BackupIcon />,
    children: [
      {
        title: 'Overview',
        segment: '',
        icon: <DashboardIcon />,
      },
      {
        title: 'Repository',
        segment: 'repository',
        icon: <BookmarkIcon />,
      },
      {
        title: 'Snapshots',
        segment: 'snapshots',
        icon: <PhotoLibraryIcon />,
      },
      {
        title: 'Scheduling',
        segment: 'scheduling',
        icon: <ScheduleIcon />,
      },
    ],
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
    <SessionContext.Provider value={sessionContextValue}>
      <DeploymentProvider>
        <AppProvider
          authentication={AUTHENTICATION}
          navigation={NAVIGATION}
          branding={BRANDING}
          session={session}
          router={router}
        >
          <Outlet />
        </AppProvider>
      </DeploymentProvider>
    </SessionContext.Provider>
  );
}