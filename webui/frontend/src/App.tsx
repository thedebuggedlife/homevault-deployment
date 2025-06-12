import * as React from "react";
import {
    Bookmark as BookmarkIcon,
    Dashboard as DashboardIcon,
    Extension as ExtensionIcon,
    Backup as BackupIcon,
    Schedule as ScheduleIcon,
    PhotoLibrary as PhotoLibraryIcon,
} from "@mui/icons-material";
import { AppProvider } from "@toolpad/core/AppProvider";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DialogsProvider, type Authentication, type Navigation, type Router } from "@toolpad/core";
import { SessionProvider } from "./contexts/SessionProvider";
import { BackupProvider } from "./contexts/BackupProvider";
import { useSession } from "./contexts/SessionContext";

function AppContent() {
    const { session, signOut } = useSession();

    const NAVIGATION: Navigation = [
        {
            kind: "header",
            title: "Navigation",
        },
        {
            title: "Dashboard",
            segment: "dashboard",
            icon: <DashboardIcon />,
        },
        {
            title: "Modules",
            segment: "modules",
            icon: <ExtensionIcon />,
        },
        {
            title: "Backup",
            icon: <BackupIcon />,
            children: [
                {
                    title: "Overview",
                    segment: "backup",
                    icon: <DashboardIcon />,
                },
                {
                    title: "Repository",
                    segment: "backup/repository",
                    icon: <BookmarkIcon />,
                },
                {
                    title: "Snapshots",
                    segment: "backup/snapshots",
                    icon: <PhotoLibraryIcon />,
                },
                {
                    title: "Scheduling",
                    segment: "backup/scheduling",
                    icon: <ScheduleIcon />,
                },
            ],
        },
    ];

    const BRANDING = {
        title: "HomeVault",
    };

    const AUTHENTICATION: Authentication = {
        signIn: () => {},
        signOut: signOut,
    };
    
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

    return (
        <BackupProvider>
            <AppProvider
                authentication={AUTHENTICATION}
                navigation={NAVIGATION}
                branding={BRANDING}
                session={session}
                router={router}
            >
                <Outlet />
            </AppProvider>
        </BackupProvider>
    );
}

export default function App() {
    return (
        <DialogsProvider>
            <SessionProvider>
                <AppContent></AppContent>
            </SessionProvider>
        </DialogsProvider>
    )
}