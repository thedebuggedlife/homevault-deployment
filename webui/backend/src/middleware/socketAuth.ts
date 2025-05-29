import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth';
import { User } from '@/types';
import { logger } from '@/logger';

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

        // Verify the token
        jwt.verify(token, JWT_SECRET, (err: jwt.VerifyErrors | null, decoded: any) => {
            if (err) {
                logger.warn('Socket connection attempt with invalid token');
                return next(new Error('Invalid authentication token'));
            }

            // Attach user info to socket for later use
            socket.data = socket.data ?? {};
            socket.data.user = decoded as User;
            logger.info(`Socket authenticated for user: ${decoded.username}`);
            next();
        });
    } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
    }
} 