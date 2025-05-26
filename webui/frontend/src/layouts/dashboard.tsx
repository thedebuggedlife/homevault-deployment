import { Navigate, Outlet, useLocation } from "react-router";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { Container, Typography } from "@mui/material";
import { useSession } from "@/contexts/SessionContext";
import { LinearProgress } from "@mui/material";

export default function Layout() {
    const { session, loading } = useSession();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{ width: "100%" }}>
                <LinearProgress />
            </div>
        );
    }

    if (!session) {
        // Add the `callbackUrl` search parameter
        const redirectTo = `/login?callbackUrl=${encodeURIComponent(location.pathname)}`;
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <DashboardLayout>
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {location.pathname.split('/').pop()?.charAt(0).toUpperCase() + location.pathname.split('/').pop()?.slice(1) || 'Dashboard'}
                </Typography>
                <Outlet />
            </Container>
        </DashboardLayout>
    );
}
