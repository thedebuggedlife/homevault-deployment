import { AuthenticatedRequest } from "@/middleware/auth";
import { CheckResponse } from "@/types";
import { Response } from "express";

export function check(req: AuthenticatedRequest, res: Response<CheckResponse>) {
    res.json({ user: req.user! });
}
