import { logger } from '@/logger';
import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
}
