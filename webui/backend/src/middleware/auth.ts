import { ErrorResponse, User } from '@/types';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedRequest<TBody = any> extends Request {
  user?: User;
  headers: {
    authorization?: string;
    [key: string]: any;
  };
  body: TBody;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response<ErrorResponse>, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ errors: [{ message: "Authentication required" }] });
    }

    jwt.verify(token, JWT_SECRET, (err: jwt.VerifyErrors | null, user: any) => {
        if (err) {
            return res.status(403).json({ errors: [{ message: "Invalid token" }] });
        }
        req.user = user as User;
        next();
    });
}
