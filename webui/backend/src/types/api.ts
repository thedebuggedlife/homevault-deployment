import { DockerContainer } from "./docker";

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

export interface ErrorResponse {
    error: string;
}