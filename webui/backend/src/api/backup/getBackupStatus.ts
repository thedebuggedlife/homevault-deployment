import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth"
import installer from "@/services/installer";
import { BackupStatus } from "@/types/backup";
import _ from "lodash";

export default async function getBackupStatus(_req: AuthenticatedRequest, res: Response<BackupStatus>, next: NextFunction) {
    try {
        const status = await installer.getBackupStatus();
        const snapshots = await installer.listSnapshots("latest");
        status.lastBackupTime = _.last(snapshots)?.time;
        res.json(status);
    } catch (error) {
        next(error);
    }
}
