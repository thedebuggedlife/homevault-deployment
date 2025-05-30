import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { CurrentActivity } from "@/types";
import { Response } from "express";

export function getActivity(_req: AuthenticatedRequest, res: Response<CurrentActivity>) {
    const activity = installer.getCurrentActivity() ?? { type: 'none' };
    res.json(activity);
}
