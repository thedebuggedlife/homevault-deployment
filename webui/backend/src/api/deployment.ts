import { logger } from "@/logger";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeploymentConfig, DeploymentRequest, DeploymentResponse } from "@/types";
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

export async function startDeployment(
    req: AuthenticatedRequest<DeploymentRequest>,
    res: Response<DeploymentResponse>,
    next: NextFunction
) {
    try {
        const activity = await installer.startDeployment(req.body);
        return res.json({ activityId: activity.id });
    } catch (error) {
        next(error);
    }
}