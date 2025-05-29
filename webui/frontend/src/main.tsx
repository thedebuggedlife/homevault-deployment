import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App";
import Layout from "./layouts/dashboard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Modules from "./pages/Modules";
import Deployment from "./pages/Deployment";

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
