import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from "express";
import { logger } from "@/logger";
import { ErrorResponse, SystemStatusResponse } from "@/types";
import docker from "@/services/docker";
import installer from "@/services/installer";
import system from "@/services/system";

export async function status(_req: AuthenticatedRequest, res: Response<SystemStatusResponse|ErrorResponse>) {
    try {
        const status: SystemStatusResponse = {
          version: await installer.getVersion(),
          resources: await system.getStatus(),
          dockerContainers: await docker.listContainers(),
          installedModules: await installer.getInstalledModules(),
        }
        res.json(status);
    } catch (error) {
        logger.error("Failed to get system status:", error);
        res.status(500).json({ errors: ["Failed to get system status"] });
    }
}
