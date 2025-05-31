import { DockerContainer } from "./docker";

export interface User {
    username: string;
    token?: string;
}

export interface SystemResources {
    cpuLoad: number;
    memoryTotal: number;
    memoryUsage: number;
    diskTotal: number;
    diskUsage: number;
}

export type CurrentActivity = DeploymentActivity | BackupActivity | { type: 'none' }

export interface DeploymentActivity {
    id: string;
    type: 'deployment';
    request: DeploymentRequest;
}

export interface BackupActivity {
    id: string;
    type: 'backup';
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
    username: string;
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
    started: (activityId: string) => void;
    output: (data: string, offset: number) => void;
    backfill: (data: string[]) => void;
    completed: () => void;
    error: (message: string) => void;
}

export interface DeploymentClientEvents {
    start: (request: DeploymentRequest) => void;
    attach: (id: string) => void;
    abort: () => void;
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
    expiresInSec: number;
}

export interface RefreshResponse {
    user: User;
    token?: string;
    expiresInSec: number;
}

export interface ErrorInstance {
    message: string;
    context?: any;
}

export interface ErrorResponse {
    errors: ErrorInstance[];
}
