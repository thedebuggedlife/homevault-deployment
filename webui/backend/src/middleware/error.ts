import { logger } from '@/logger';
import { ErrorResponse } from '@/types';
import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) {
  if (err instanceof ServiceError) {
    logger.error(err.message, err.context);
    res.status(500).json({ errors: [ err ]});
  } else {
    logger.error("Error handling request", err);
    res.status(500).json({ errors: [{ message: err.message ?? "Something went wrong!" }] });
  }
}
