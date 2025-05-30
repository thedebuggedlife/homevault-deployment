import { DeployModules } from '@/types';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface DeploymentState {
    modules: DeployModules;
    backPath?: string;
    backTitle?: string;
}

export function useDeploymentState() {
    const location = useLocation();
    
    return useMemo<DeploymentState>(() => {
        const state = location.state as DeploymentState;
        return {
            modules: {
                install: state?.modules?.install ?? [],
                remove: state?.modules?.remove ?? [],
            },
            backPath: state?.backPath ?? '/',
            backTitle: state?.backTitle ?? 'Home'
        };
    }, [location.state]);
}