import { logger } from "@/logger";
import { exec } from "child_process";
import { validationResult } from "express-validator";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/middleware/auth";

export async function login(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if user exists and has sudo privileges
    exec(`echo '${password}' | sudo -S -l -U ${username}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Authentication failed for user ${username}: ${error.message}`);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check if user has sudo privileges
        if (!stdout.includes("(ALL : ALL)") && !stdout.includes("(ALL) ALL")) {
            logger.warn(`User ${username} attempted login without sudo privileges`);
            return res.status(403).json({ error: "User does not have required privileges" });
        }

        // Generate JWT token
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    });
}
