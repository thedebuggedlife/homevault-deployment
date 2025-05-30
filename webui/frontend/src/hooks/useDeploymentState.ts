import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface DeploymentState {
    modules: string[];
    backPath?: string;
    backTitle?: string;
}

export function useDeploymentState() {
    const location = useLocation();
    
    return useMemo(() => {
        const state = location.state as DeploymentState;
        return {
            modules: state?.modules || [],
            backPath: state?.backPath || '/',
            backTitle: state?.backTitle || 'Home'
        };
    }, [location.state]);
}