import { ServiceError } from "@/errors";
import { logger } from "@/logger";
import { AuthenticatedRequest } from "@/middleware/auth";
import { ServerActivity } from "@/types";
import { NextFunction, Request, Response } from "express";
import SessionManager from "@/services/session";
import activity from "@/services/activity";

interface SudoRequest {
    nonce: string,
    username: string,
    timeoutSec: number,
}

interface SudoResponse {
    password?: string,
}

export function getActivity(_req: AuthenticatedRequest, res: Response<ServerActivity>, next: NextFunction) {
    try {
        const current = activity.getCurrent();
        if (current) {
            return res.json(current);
        } else {
            return res.status(404).send();
        }
    } catch (error) {
        next(error);
    }
}

export async function postActivitySudo(req: Request<{}, SudoResponse, SudoRequest>, res: Response<SudoResponse>, next: NextFunction) {
    try {
        const sudo = req.body;
        logger.info("[sudo] credentials requested for " + sudo?.nonce);
        if (!sudo?.nonce) {
            throw new ServiceError("Missing nonce in sudo request", null, 400);
        }
        if (!sudo?.username) {
            throw new ServiceError("Missing username in sudo request", null, 400);
        }
        const session = SessionManager.get(sudo.nonce);
        if (!session) {
            throw new ServiceError("Nonce does not match any existing sessions", null, 400);
        }
        const timeoutMs = (req.body.timeoutSec ?? 120) * 1000 - 150;
        const password = await session.askSudo(sudo.username, timeoutMs);
        return res.status(200).json({ password });
    } catch (error) {
        next(error);
    }
}