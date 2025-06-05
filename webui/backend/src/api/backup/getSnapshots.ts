import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth"
import installer from "@/services/installer";
import { BackupSnapshot } from "@/types/backup";
import _ from "lodash";

export default async function getSnapshots(_req: AuthenticatedRequest, res: Response<BackupSnapshot[]>, next: NextFunction) {
    try {
        const snapshots = await installer.listSnapshots();
        res.json(snapshots);
    } catch (error) {
        next(error);
    }
}
