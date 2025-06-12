import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { BackupRunRequest, BackupRunResponse } from "@/types/backup";
import { Response, NextFunction } from "express";

export default async function runBackup(
    req: AuthenticatedRequest<BackupRunRequest>,
    res: Response<BackupRunResponse>,
    next: NextFunction
) {
    try {
        await installer.runBackup(req.body);
        return res.status(200).send();
    } catch (error) {
        return next(error);
    }
}
