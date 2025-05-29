import { DockerContainer } from "./docker";

export interface User {
    username: string;
}

export interface SystemResources {
    cpuLoad: number;
    memoryTotal: number;
    memoryUsage: number;
    diskTotal: number;
    diskUsage: number;
}

export interface DeploymentRequest {
    modules?: {
        install?: string[];
        remove?: string[];
    }
    config?: {
        variables?: Record<string, string>;
        password?: string;
    }
}

export interface DeploymentConfig {
    prompts: {
        module: string;
        variable: string;
        prompt: string;
        optional: boolean;
        password: boolean;
        default?: string;
        condition?: string;
        options?: string[];
        regex?: {
            pattern: string;
            message?: string;
        }[];
    }[];
}

export interface DeploymentServerEvents {
    output: (data: string) => void;
    completed: () => void;
    error: (message: string) => void;
}

export interface DeploymentClientEvents {
    start: (request: DeploymentRequest) => void;
}

export interface SystemStatusResponse {
    version: string;
    resources: SystemResources;
    dockerContainers: DockerContainer[];
    installedModules: string[];
}

export interface GetModulesResponse {
    installedModules: string[];
    availableModules: Record<string, string>;
}

export interface LoginResponse {
    token: string;
}

export interface CheckResponse {
    user: User;
}

export interface ErrorInstance {
    message: string;
    context?: any;
}

export interface ErrorResponse {
    errors: ErrorInstance[];
}
