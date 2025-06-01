import { getErrorMessage, ServiceError } from "@/errors";
import { logger } from "@/logger";
import { ErrorResponse } from "@/types";
import { NextFunction, Request, Response } from "express";

export function errorHandler(error: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) {
    if (error instanceof ServiceError) {
        logger.warn(error.message, { context: error.context });
        return res.status(error.status).json({ errors: [ { message: error.message, context: error.context } ] });
    } else {
        logger.error("Error handling request", { error });
        return res.status(500).json({ errors: [{ message: "Error handling request: " + getErrorMessage(error) }] });
    }
}
