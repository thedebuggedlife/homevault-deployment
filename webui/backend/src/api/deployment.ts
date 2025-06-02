import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeploymentConfig, DeploymentRequest } from "@/types";
import { NextFunction, Response } from "express";

export async function getDeploymentConfig(
    req: AuthenticatedRequest<DeploymentRequest>,
    res: Response<DeploymentConfig>,
    next: NextFunction
) {
    try {
        const config = await installer.getDeploymentConfig(req.body);
        return res.json(config);
    } catch (error) {
        next(error);
    }
}
