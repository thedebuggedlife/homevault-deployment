import { Outlet } from "react-router";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { Container, Typography } from "@mui/material";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout() {
    return (
        <ProtectedRoute>
            <DashboardLayout>
                <Container maxWidth="xl" sx={{ py: 3 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        {location.pathname.split('/').pop()?.charAt(0).toUpperCase() + location.pathname.split('/').pop()?.slice(1) || 'Dashboard'}
                    </Typography>
                    <Outlet />
                </Container>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
