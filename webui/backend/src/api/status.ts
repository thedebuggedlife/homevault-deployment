import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from "express";
import { ErrorResponse, SystemStatusResponse } from "@/types";
import docker from "@/services/docker";
import installer from "@/services/installer";
import system from "@/services/system";

export async function getStatus(_req: AuthenticatedRequest, res: Response<SystemStatusResponse|ErrorResponse>) {
    const status: SystemStatusResponse = {
        version: await installer.getVersion(),
        resources: await system.getStatus(),
        dockerContainers: await docker.listContainers(),
        installedModules: await installer.getInstalledModules(),
    }
    res.json(status);
}
