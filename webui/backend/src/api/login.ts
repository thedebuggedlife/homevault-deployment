import { logger } from "@/logger";
import { exec, spawn } from "child_process";
import { Request, Response } from "express";
import tokenGenerator, { JWT_EXPIRES } from "@/tokenGenerator";
import { ErrorResponse, LoginResponse, User } from "@/types";
import { readFile } from "fs/promises";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function login(req: Request, res: Response<LoginResponse|ErrorResponse>) {
    const { username, password } = req.body;

    if (!isValidUsername(username)) {
        return res.status(400).json({ errors: [{ message: "Invalid username format" }] });
    }

    try {
        if (! await checkSudo(username)) {
            logger.warn(`User ${username} attempted login without sudo privileges`);
            return res.status(403).json({ errors: [{ message: "User does not have required privileges" }] });
        }
        if (! await checkPassword(username, password)) {
            logger.error(`Authentication failed for user ${username}`);
            return res.status(401).json({ errors: [{ message: "Invalid credentials" }] });
        }
    } catch (error) {
        logger.error("Failed to check for user access", { username, error });
        return res.status(500).json({ errors: [{ message: "Failed to check for user access" }] });
    }

    const user: User = { username };
    const token = await tokenGenerator.sign({ user });
    return res.json({ token, expiresInSec: JWT_EXPIRES });
}

function isValidUsername(username: string): boolean {
    // Only allow alphanumeric, underscore, dash
    return /^[a-zA-Z0-9_-]+$/.test(username);
}

function checkPassword(username: string, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const child = spawn("su", ["-c", "exit 0", username]);
        child.stdin.write(password + "\n");
        child.stdin.end();
        child.on("error", error => reject(error));
        child.on("close", (code: number) => {
            resolve(code === 0)
        });
    });
}

async function checkSudo(username: string): Promise<boolean> {
    try {
        const { stdout } = await execAsync(`groups ${username}`);
        return stdout.includes('sudo') || stdout.includes('wheel');
    } catch (error) {
        logger.warn("Failed to get group information", { username, error });
        try {
            const groupFile = await readFile('/etc/group', 'utf-8');
            const sudoLine = groupFile.split('\n').find(line => 
                line.startsWith('sudo:') || line.startsWith('wheel:')
            );
            
            if (sudoLine) {
                const members = sudoLine.split(':')[3]?.split(',') || [];
                return members.includes(username);
            }
        } catch (error) {
            logger.warn("Failed to read group information", { username, error });
            return false;
        }
    }
    return false;
}
