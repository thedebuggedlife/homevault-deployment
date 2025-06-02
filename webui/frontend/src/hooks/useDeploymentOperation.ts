import { useState, useCallback, useEffect, useRef } from 'react';
import backend, { DeploymentOperation } from '@/backend';
import { DeploymentActivity } from '@backend/types';
import { useSession } from '@/contexts/SessionContext';

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
    autoDetect?: boolean;
}

export function useDeploymentOperation(options: UseDeploymentOperationOptions = { autoAttach: true, autoDetect: false }) {
    const { session } = useSession();
    const [loading, setLoading] = useState(true);
    const [output, setOutput] = useState<string[]>([]);
    const [operation, setOperation] = useState<DeploymentOperation>(null);
    const [activity, setActivity] = useState<DeploymentActivity>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const operationRef = useRef<DeploymentOperation>(null);

    useEffect(() => {
        if (options.autoDetect) {
            return backend.on("deployment", newOp => {
                setOperation(newOp);
                if (newOp) {
                    setIsCompleted(!newOp.isInstalling)
                    newOp.on("closed", () => {
                        setOperation(null);
                    });
                }
            });
        }
    }, [options.autoDetect])

    const attachOperation = (operation: DeploymentOperation) => {
        setOperation(operation);
        setIsCompleted(!operation.isInstalling);
        operationRef.current = operation;

        operation.on("output", (outputLine: string) => {
            setOutput(prev => [...prev, outputLine]);
        });

        operation.on("backfill", (buffer: string[]) => {
            setOutput(prev => [...buffer, ...prev]);
        })
        
        operation.on("error", (message: string) => {
            setError(message ?? "Something went wrong. Please try again.");
            setIsCompleted(true);
        });

        operation.on("completed", () => {
            setIsCompleted(true);
        });
    }

    const startDeployment = useCallback(async (request: DeploymentRequest) => {
        setError(null);
        setOutput([]);
        setOperation(null);
        setIsCompleted(false);

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
            if (session == null) {
                return;
            }
            const currentActivity = await backend.getCurrentActivity();
            if (currentActivity && currentActivity.type === 'deployment') {
                console.log("Current activity: ", currentActivity);
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
    }, [options.autoAttach, session]);

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
        isCompleted,
        startDeployment,
        checkCurrentDeployment
    };
}