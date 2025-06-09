import { ServiceError } from "@/errors";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { BackupSchedule } from "@/types/backup";
import { Response, NextFunction } from "express";

export default async function updateSchedule(req: AuthenticatedRequest<BackupSchedule>, res: Response, next: NextFunction) {
    try {
        if (!req.body) {
            throw new ServiceError("Missing request body", null, 400);
        }
        await installer.updateSchedule(req.body);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
}