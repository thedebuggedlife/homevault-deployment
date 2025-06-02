import { AuthenticatedRequest } from "@/middleware/auth";
import { NextFunction, Response } from "express";
import { GetModulesResponse } from "@/types";
import installer from "@/services/installer";

export async function getModules(_req: AuthenticatedRequest, res: Response<GetModulesResponse>, next: NextFunction) {
    try {
        const response: GetModulesResponse = {
            installedModules: await installer.getInstalledModules(),
            availableModules: await installer.getAvailableModules(),
        };
        return res.json(response);
    } catch (error) {
        next(error);
    }
}
