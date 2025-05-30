import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { logger } from '@/logger';
import { User } from './types';
import { ServiceError } from './errors';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key';
export const JWT_EXPIRES = parseInt(process.env.JWT_EXPIRES ?? "3600"); // In seconds

const MIN_EXPIRES_IN = Math.floor(JWT_EXPIRES / 2);

const defaultSignOptions: SignOptions = {
    expiresIn: JWT_EXPIRES,
}

export interface RefreshOptions extends SignOptions {
    validate?: VerifyOptions;
    jwtid?: string;
}

export interface RefreshResult {
    token: string;
    expiresInSec: number;
}

export interface TokenPayload extends JwtPayload {
    user: User;
}

export function getExpiresInSec(exp: number) {
    return Math.max(0, Math.floor(exp - Date.now()/1000));
}

class TokenGenerator<T extends JwtPayload> {
    sign(payload: T, signOptions?: SignOptions): Promise<string> {
        signOptions = {
            ...defaultSignOptions,
            ...signOptions
        };
        return new Promise<string>((resolve, reject) => {
            jwt.sign(payload, JWT_SECRET, signOptions, (err, token) => {
                if (err) {
                    reject(err);
                }
                if (!token) {
                    logger.warn("Empty token was generated");
                    reject(new ServiceError("Empty token was generated"));
                } else {
                    resolve(token);
                }
            })
        });
    }
    verify(token: string, options?: VerifyOptions): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            jwt.verify(token, JWT_SECRET, options, (err, payload) => {
                if (err) {
                    reject(err);
                }
                if (typeof payload !== 'object') {
                    logger.warn("Invalid payload returned from token", { payload });
                    reject(new ServiceError("Invalid payload returned from token"));
                } else {
                    resolve(payload as T);
                }
            });
        })
    }
    async refresh(token: T, refreshOptions?: RefreshOptions): Promise<RefreshResult|undefined> {
        if (!token.exp) {
            logger.warn("Invalid token is missing expiration time");
            throw new ServiceError("Invalid token is missing expiration time");
        }
        const expiresInSec = getExpiresInSec(token.exp);
        if (expiresInSec > MIN_EXPIRES_IN) {
            logger.warn("Attempted to refresh token before minimum expiration time", { token })
            return;
        }
        logger.info("Refreshing token", { token, expiresInSec });
        const payload = { ...token };
        delete payload.iat;
        delete payload.exp;
        delete payload.nbf;
        delete payload.jti;
        return {
            token: await this.sign(payload, defaultSignOptions),
            expiresInSec: JWT_EXPIRES
        };
    }
}

export default new TokenGenerator<TokenPayload>();