import { Navigate, Outlet, useLocation } from "react-router";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
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
            <PageContainer>
                <Outlet />
            </PageContainer>
        </DashboardLayout>
    );
}
