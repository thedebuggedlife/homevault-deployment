import { AuthenticatedRequest } from "@/middleware/auth";
import { NextFunction, Response } from "express";
import { SystemStatusResponse } from "@/types";
import docker from "@/services/docker";
import installer from "@/services/installer";
import system from "@/services/system";

export async function getStatus(_req: AuthenticatedRequest, res: Response<SystemStatusResponse>, next: NextFunction) {
    try {
        const status: SystemStatusResponse = {
            version: await installer.getVersion(),
            resources: await system.getStatus(),
            dockerContainers: await docker.listContainers(),
            installedModules: await installer.getInstalledModules(),
        };
        return res.json(status);
    } catch (error) {
        next(error);
    }
}
