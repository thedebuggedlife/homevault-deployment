import React from 'react';
import { Navigate, useLocation } from "react-router";
import { LinearProgress } from "@mui/material";
import { useSession } from "@/contexts/SessionContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return fallback || (
      <div style={{ width: "100%" }}>
        <LinearProgress />
      </div>
    );
  }

  if (!session) {
    const redirectTo = `/login?callbackUrl=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}