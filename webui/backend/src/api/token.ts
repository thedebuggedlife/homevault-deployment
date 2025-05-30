import { logger } from "@/logger";
import { AuthenticatedRequest } from "@/middleware/auth";
import tokenGenerator, { getExpiresInSec } from "@/tokenGenerator";
import { ErrorResponse, RefreshResponse } from "@/types";
import { Response } from "express";

export async function refreshToken(req: AuthenticatedRequest, res: Response<RefreshResponse|ErrorResponse>) {
    if (!req.token?.exp) {
        logger.warn("Provided token is missing expiration time");
        return res.status(403).json({ errors: [{ message: "Invalid token" }] });
    }
    const result = await tokenGenerator.refresh(req.token);
    const response = {
        user: req.token.user,
        token: result?.token,
        expiresInSec: result ? result.expiresInSec : getExpiresInSec(req.token.exp),
    }
    res.json(response);
}