import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeploymentConfig, DeploymentRequest, ErrorResponse } from "@/types";
import { Response } from "express";

export async function getDeploymentConfig(req: AuthenticatedRequest<DeploymentRequest>, res: Response<DeploymentConfig|ErrorResponse>) {
    const config = await installer.getDeploymentConfig(req.body);
    res.json(config);
}
