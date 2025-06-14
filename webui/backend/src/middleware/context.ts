import { AsyncLocalStorage } from 'async_hooks';
import { Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { AuthenticatedRequest } from './auth';
import { User } from '@/types';
import { ServiceError } from '@/errors';

export interface RequestContext {
  requestId: string;
  startTime: number;
  user?: User;
  sessionId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function requestContext() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const context: RequestContext = {
      requestId: uuid(),
      startTime: Date.now(),
      user: req.token?.user,
      sessionId: req.query["sessionId"] as string,
    };

    asyncLocalStorage.run(context, () => {
      next();
    });
  };
}

export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function requireContext(): RequestContext {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    throw new ServiceError('No request context available.');
  }
  return context;
}

export function getSessionId(): string | undefined {
    const context = getContext();
    return context?.sessionId;
}

export function getUsername(): string | undefined {
    const context = getContext();
    return context?.user?.username;
}

export function getRequestDuration(): number {
  const context = getContext();
  if (!context) return 0;
  return Date.now() - context.startTime;
}