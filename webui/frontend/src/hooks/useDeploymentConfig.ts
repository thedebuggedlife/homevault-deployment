import { useState, useEffect, useCallback } from 'react';
import { DeploymentConfig } from '@backend/types';
import backend from '@/backend';

export function useDeploymentConfig(modules: string[]) {
    const [config, setConfig] = useState<DeploymentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadConfig = useCallback(async () => {
        if (modules.length === 0) {
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            setError(null);
            
            const deploymentConfig = await backend.getDeploymentConfig({
                modules: { install: modules }
            });
            
            setConfig(deploymentConfig);
        } catch (err) {
            setError('Failed to load deployment configuration');
            console.error('Error loading deployment config:', err);
        } finally {
            setLoading(false);
        }
    }, [modules]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    return { config, loading, error, reload: loadConfig };
}