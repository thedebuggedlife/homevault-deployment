import { Outlet, useMatches } from "react-router-dom";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { Container, Typography } from "@mui/material";
import ProtectedRoute from "@/components/ProtectedRoute";
import _ from "lodash";
import { AppTitle } from "@/components/AppTitle";

export interface RouteHandle {
    title: string;
    fullPage?: boolean;
    hideNavigation?: boolean;
}

export default function Layout() {
    const matches = useMatches();
    const handle = _.last(matches)?.handle as RouteHandle;
    return (
        <ProtectedRoute>
            <DashboardLayout hideNavigation={!!handle?.hideNavigation} slots={{ appTitle: () => <AppTitle/> }}>
                { !handle?.fullPage &&
                    <Container maxWidth="xl" sx={{ py: 3 }}>
                        <Typography variant="h4" component="h1" gutterBottom>
                                {handle?.title ?? "Dashboard"}
                            </Typography>
                        <Outlet />
                    </Container>
                }
                { handle?.fullPage && <Outlet /> }
            </DashboardLayout>
        </ProtectedRoute>
    );
}
