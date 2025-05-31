import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { CurrentActivity } from "@/types";
import { NextFunction, Response } from "express";

export function getActivity(_req: AuthenticatedRequest, res: Response<CurrentActivity>, next: NextFunction) {
    try {
        const activity = installer.getCurrentActivity() ?? { type: "none" };
        return res.json(activity);
    } catch (error) {
        next(error);
    }
}
