import { ServiceError } from "@/errors";
import { AuthenticatedRequest } from "@/middleware/auth";
import tokenGenerator from "@/tokenGenerator";
import { RefreshResponse } from "@/types";
import { NextFunction, Response } from "express";

export async function refreshToken(req: AuthenticatedRequest, res: Response<RefreshResponse>, next: NextFunction) {
    try {
        if (!req.token) {
            throw new ServiceError("Missing token in request", null, 403);
        }
        const result = await tokenGenerator.refresh(req.token);
        const response = {
            user: req.token.user,
            token: result.token,
            expiresInSec: result.expiresInSec,
        };
        return res.json(response);
    } catch (error) {
        next(error);
    }
}