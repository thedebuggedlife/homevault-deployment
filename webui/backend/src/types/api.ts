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

export interface SystemStatusResponse {
    version: string;
    resources: SystemResources;
    dockerContainers: DockerContainer[];
    installedModules: string[];
}

export interface LoginResponse {
    token: string;
}

export interface CheckResponse {
    user: User;
}

export interface ErrorResponse {
    errors: string[];
}
