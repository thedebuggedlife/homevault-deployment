import { ServiceError } from "@/errors";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeleteSnapshotParams } from "@/types/backup";
import { Response, NextFunction } from "express";

export default async function deleteSnapshot(req: AuthenticatedRequest<{}, DeleteSnapshotParams>, res: Response, next: NextFunction) {
    try {
        if (!req.params?.snapshotId) {
            throw new ServiceError("Missing snapshot id", null, 400);
        }
        await installer.deleteSnapshot(req.params.snapshotId);
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
}
