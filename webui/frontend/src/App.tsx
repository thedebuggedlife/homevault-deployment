import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ModuleInstallation from '@/pages/ModuleInstallation';
import SystemStatus from '@/pages/SystemStatus';
import BackupRestore from '@/pages/BackupRestore';
import Layout from '@/components/Layout';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/modules"
              element={
                <PrivateRoute>
                  <Layout>
                    <ModuleInstallation />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/status"
              element={
                <PrivateRoute>
                  <Layout>
                    <SystemStatus />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <PrivateRoute>
                  <Layout>
                    <BackupRestore />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App; 