import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App";
import Layout from "./layouts/dashboard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Modules from "./pages/Modules";
import Deployment from "./pages/Deployment";
import BackupRepository from "./pages/backup/Repository";
import BackupSnapshots from "./pages/backup/Snapshots";
import BackupScheduling from "./pages/backup/Scheduling";

const router = createBrowserRouter([
    {
        Component: App, // root layout route
        children: [
            {
                path: "/",
                Component: Layout,
                children: [
                    {
                        index: true,
                        element: <Navigate to="/dashboard" replace />,
                    },
                    {
                        path: "dashboard",
                        Component: Dashboard,
                        handle: {
                            title: "Dashboard",
                        },
                    },
                    {
                        path: "modules",
                        Component: Modules,
                        handle: {
                            title: "Modules",
                        },
                    },
                    {
                        path: "deployment",
                        Component: Deployment,
                        handle: {
                            title: "Deployment",
                            hideNavigation: true,
                            fullPage: true,
                        },
                    },
                    {
                        path: "backup",
                        children: [
                            {
                                index: true,
                                element: <Navigate to="/backup/snapshots" replace />,
                            },
                            {
                                path: "repository",
                                Component: BackupRepository,
                                handle: {
                                    title: "Repository Configuration",
                                },
                            },
                            {
                                path: "snapshots",
                                Component: BackupSnapshots,
                                handle: {
                                    title: "Snapshots",
                                },
                            },
                            {
                                path: "scheduling",
                                Component: BackupScheduling,
                                handle: {
                                    title: "Backup Scheduling",
                                },
                            },
                        ],
                    }
                ],
            },
            {
                path: "/login",
                Component: Login,
            },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
