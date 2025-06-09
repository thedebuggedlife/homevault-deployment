import { logger } from "@/logger";
import tokenGenerator, { TokenPayload } from "@/tokenGenerator";
import { ErrorResponse } from "@/types";
import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";

export interface AuthenticatedRequest<TBody = any, TParams = {}> extends Request<TParams, TBody> {
    token?: TokenPayload;
    headers: {
        authorization?: string;
        [key: string]: any;
    };
    body: TBody;
    params: TParams;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response<ErrorResponse>, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ errors: [{ message: "Authentication required" }] });
    }

    try {
        req.token = await tokenGenerator.verify(token);
        next();
    } catch (error) {
        logger.warn("Request made with invalid token", { error });
        return res.status(403).json({ errors: [{ message: "Invalid token" }] });
    }
}

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
    try {
        // Try to get token from handshake headers first
        const authHeader = socket.handshake.headers.authorization;
        let token: string | undefined;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            // Fallback to query parameter
            token = socket.handshake.auth.token || socket.handshake.query.token as string;
        }

        if (!token) {
            logger.warn('Socket connection attempt without authentication token');
            return next(new Error('Authentication token required'));
        }

        tokenGenerator.verify(token)
            .then(payload => {
                socket.data = socket.data ?? {};
                socket.data.user = payload.user;
                logger.info(`Socket authenticated for user: ${payload.user.username}`);
                next();
            })
            .catch(error => {
                logger.warn('Socket connection attempt with invalid token', { error });
                return next(new Error('Invalid authentication token'));
            });
    } catch (error) {
        logger.error('Socket authentication error:', { error });
        next(new Error('Authentication failed'));
    }
} 