import { ServiceError } from "@/errors";
import { logger } from "@/logger";
import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { CurrentActivity } from "@/types";
import { NextFunction, Request, Response } from "express";

interface SudoRequest {
    nonce: string,
}

interface SudoResponse {
    password: string,
}

export function getActivity(_req: AuthenticatedRequest, res: Response<CurrentActivity>, next: NextFunction) {
    try {
        const activity = installer.getCurrentActivity() ?? { type: "none" };
        return res.json(activity);
    } catch (error) {
        next(error);
    }
}

export function postActivitySudo(req: Request, res: Response<SudoResponse>, next: NextFunction) {
    try {
        const sudo = req.body as SudoRequest;
        logger.info("[sudo] credentials requested for " + sudo?.nonce);
        if (!sudo?.nonce) {
            throw new ServiceError("Missing nonce in sudo request", null, 400);
        }
        return res.status(200).json({ password: installer.sudoForActivity(sudo.nonce) });
    } catch (error) {
        next(error);
    }
}