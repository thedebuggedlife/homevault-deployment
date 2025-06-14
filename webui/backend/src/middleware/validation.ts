import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "@/types";

export function handleValidationErrors(req: Request, res: Response<ErrorResponse>, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map((err) => ({ message: err.msg, context: err })) });
    }
    next();
}
