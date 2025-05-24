import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from "express";

export function check(_req: AuthenticatedRequest, res: Response) {
    res.json({ message: "Protected route accessed successfully" });
}
