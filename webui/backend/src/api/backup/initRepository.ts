import { ServiceError } from "@/errors";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { BackupInitRequest } from "@/types/backup";
import { Response, NextFunction } from "express";

export default async function initRepository(req: AuthenticatedRequest<BackupInitRequest>, res: Response, next: NextFunction) {
    try {
        const repository = req.body?.repository;
        if (!repository) {
            throw new ServiceError("Missing repository information in the request", null, 400);
        }
        await installer.initRepository(repository);
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
}