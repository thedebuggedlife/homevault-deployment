import { getErrorMessage, ServiceError } from '@/errors';
import { logger } from '@/logger';
import { ErrorResponse } from '@/types';
import { NextFunction, Request, Response } from 'express';

export function errorHandler(error: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) {
  if (error instanceof ServiceError) {
    logger.error(error.message, error.context);
    res.status(500).json({ errors: [ error ]});
  } else {
    logger.error("Error handling request", { error });
    res.status(500).json({ errors: [{ message: "Error handling request: " + getErrorMessage(error) }] });
  }
}
