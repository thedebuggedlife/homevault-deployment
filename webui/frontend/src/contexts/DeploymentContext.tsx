import { createContext } from 'react';

interface DeploymentContextType {
    isDeploying: boolean;
}

export const DeploymentContext = createContext<DeploymentContextType>({ isDeploying: false });


