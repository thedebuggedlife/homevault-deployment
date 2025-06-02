import { useContext } from "react";
import { DeploymentContext } from "@/contexts/DeploymentContext";


export function useDeployment() {
    return useContext(DeploymentContext);
}
