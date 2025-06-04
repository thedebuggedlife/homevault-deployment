import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth"
import installer from "@/services/installer";

export default async function getBackupStatus(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const status = await installer.getBackupStatus();
        res.json(status);
    } catch (error) {
        next(error);
    }
}
