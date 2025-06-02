import { useDeploymentOperation } from "@/hooks/useDeploymentOperation";
import { ReactNode } from "react";
import { DeploymentContext } from "./DeploymentContext";

export function DeploymentProvider({ children }: { children: ReactNode; }) {
    const { operation, isCompleted } = useDeploymentOperation({ autoAttach: true, autoDetect: true });

    return (
        <DeploymentContext.Provider value={{ isDeploying: operation && !isCompleted }}>
            {children}
        </DeploymentContext.Provider>
    );
}
