import { logger } from "@/logger";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeploymentConfig, DeploymentRequest, ErrorResponse } from "@/types";
import { Response } from "express";

export async function getDeploymentConfig(req: DeploymentRequest & AuthenticatedRequest, res: Response<DeploymentConfig|ErrorResponse>) {
    try {
        const config = await installer.getDeploymentConfig(req);
        res.json(config);
    } catch (error) {
        logger.error("Failed to get system status:", error);
        res.status(500).json({ errors: ["Failed to get system status"] });
    }
}
