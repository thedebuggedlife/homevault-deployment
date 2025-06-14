import { useState, useEffect } from 'react';
import backend from '../backend/backend';
import { SystemStatusResponse, GetModulesResponse } from '@backend/types';

export function useModulesData() {
    const [status, setStatus] = useState<SystemStatusResponse | null>(null);
    const [modulesData, setModulesData] = useState<GetModulesResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingModules, setLoadingModules] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await backend.getStatus();
                setStatus(response);
            } catch (err) {
                setError('Failed to fetch system status');
                console.error('Error fetching system status:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, []);

    const fetchAvailableModules = async () => {
        setLoadingModules(true);
        try {
            const modules = await backend.getModules();
            setModulesData(modules);
        } catch (err) {
            console.error('Error fetching modules:', err);
            setError('Failed to fetch available modules');
        } finally {
            setLoadingModules(false);
        }
    };

    return {
        status,
        modulesData,
        error,
        loading,
        loadingModules,
        fetchAvailableModules
    };
}