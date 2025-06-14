import { BackupRunRequest } from "./backup";
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

type OmitFromUnion<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

export type ServerActivity = DeploymentActivity | BackupInitActivity | BackupUpdateActivity | BackupRunActivity;

export type ServerActivityWithoutId = OmitFromUnion<ServerActivity, "id">;

export interface DeploymentActivity {
    id: string;
    type: 'deployment';
    request: DeploymentRequest;
}

export interface BackupInitActivity {
    id: string;
    type: 'backup_init';
}

export interface BackupUpdateActivity {
    id: string;
    type: "backup_update";
}

export interface BackupRunActivity {
    id: string;
    type: "backup_run";
    request: BackupRunRequest;
}

export interface DeploymentRequest {
    modules?: {
        install?: string[];
        remove?: string[];
    }
    config?: {
        variables?: Record<string, string>;
    }
}

export interface DeploymentResponse {
    activityId: string;
}

export interface DeploymentPrompt {
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
}

export interface DeploymentConfig {
    username: string;
    prompts: DeploymentPrompt[];
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

export interface SudoRequest {
    username: string;
    timeoutMs: number;
}

export interface SudoResponse {
    password?: string;
}

export interface SessionServerEvents {
    hello: (id: string) => void;
    sudo: (request: SudoRequest, callback: (response: SudoResponse) => void) => void;
    activity: (current?: ServerActivity) => void;
    output: (activityId: string, output: string[]) => void;
}

export interface SessionClientEvents {
    listen: (activityId: string, callback: (output: string[]) => void) => void;
}

export interface ActivityServerEvents {
    start: () => void;
    end: (error?: string) => void;
    output: (output: string[]) => void;
}

export interface ActivityClientEvents {
    abort: () => void;
}