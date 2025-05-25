import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from "express";
import { logger } from "@/logger";
import { ErrorResponse, GetModulesResponse, SystemStatusResponse } from "@/types";
import installer from "@/services/installer";

export async function getModules(_req: AuthenticatedRequest, res: Response<GetModulesResponse|ErrorResponse>) {
    try {
        const response: GetModulesResponse = {
            installedModules: await installer.getInstalledModules(),
            availableModules: await installer.getAvailableModules(),
        }
        res.json(response);
    } catch (error) {
        logger.error("Failed to get system status:", error);
        res.status(500).json({ errors: ["Failed to get system status"] });
    }
}
