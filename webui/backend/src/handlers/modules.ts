import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from "express";
import { logger } from "@/logger";
import { ErrorResponse, GetModulesResponse } from "@/types";
import installer from "@/services/installer";

export async function getModules(_req: AuthenticatedRequest, res: Response<GetModulesResponse|ErrorResponse>) {
    const response: GetModulesResponse = {
        installedModules: await installer.getInstalledModules(),
        availableModules: await installer.getAvailableModules(),
    }
    res.json(response);
}
