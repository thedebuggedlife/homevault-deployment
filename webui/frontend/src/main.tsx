import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import App from './App';
import Layout from './layouts/dashboard';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Modules from './pages/Modules';

const router = createBrowserRouter([
  {
    Component: App, // root layout route
    children: [
      {
        path: '/',
        Component: Layout,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />
          },
          {
            path: 'dashboard',
            Component: Dashboard,
          },
          {
            path: 'modules',
            Component: Modules,
          },
        ],
      },
      {
        path: '/login',
        Component: Login,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
