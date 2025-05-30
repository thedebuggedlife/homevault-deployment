import { useState, useCallback, useEffect, useRef } from 'react';
import backend, { DeploymentOperation } from '@/backend';
import { DeploymentActivity } from '@backend/types';

interface DeploymentRequest {
    modules: {
        install: string[];
    };
    config: {
        variables: Record<string, string>;
        password: string;
    };
}

interface UseDeploymentOperationOptions {
    autoAttach?: boolean;
}

export function useDeploymentOperation(options: UseDeploymentOperationOptions = { autoAttach: true }) {
    const [loading, setLoading] = useState(true);
    const [output, setOutput] = useState<string[]>([]);
    const [operation, setOperation] = useState<DeploymentOperation>(null);
    const [activity, setActivity] = useState<DeploymentActivity>(null);
    const [error, setError] = useState<string | null>(null);
    const operationRef = useRef<DeploymentOperation>(null);

    const attachOperation = (operation: DeploymentOperation) => {
        setOperation(operation);
        operationRef.current = operation;

        operation.on("output", (outputLine: string) => {
            setOutput(prev => [...prev, outputLine]);
        });

        operation.on("backfill", (buffer: string[]) => {
            setOutput(prev => [...buffer, ...prev]);
        })
        
        operation.on("error", (message: string) => {
            setError(message ?? "Something went wrong. Please try again.");
        });
    }

    const startDeployment = useCallback(async (request: DeploymentRequest) => {
        setError(null);
        setOutput([]);
        
        try {
            const operation = await backend.startDeployment(request);
            attachOperation(operation);
        } catch (err) {
            setError('Failed to start deployment. Please try again.');
            throw err;
        }
    }, []);

    const checkCurrentDeployment = useCallback(async () => {
        try {
            setActivity(null);
            setLoading(true);
            setError(null);
            console.log("Getting current activity...");
            const currentActivity = await backend.getCurrentActivity();
            console.log("Current activity: ", currentActivity);
            if (currentActivity && currentActivity.type === 'deployment') {
                setActivity(currentActivity);
                if (options.autoAttach) {
                    try {
                        console.log("Attaching to activity...", currentActivity);
                        const operation = await backend.attachDeployment(currentActivity.id);
                        attachOperation(operation);
                    } catch (err) {
                        console.error("Failed to attach to deployment", err);
                        setError('Failed to attach to deployment. Please try again.');
                    }
                }
            }
        }
        catch (error) {
            setError("Failed to check for current deployment");
            console.error("Error checking for current deployment", error);
        }
        finally {
            setLoading(false);
        }
    }, [options.autoAttach]);

    useEffect(() => {
        checkCurrentDeployment();
    }, [checkCurrentDeployment]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            operationRef.current?.close();
            operationRef.current = null;
        };
    }, []);

    return {
        loading,
        operation,
        activity,
        output,
        error,
        startDeployment,
        checkCurrentDeployment
    };
}