import { logger } from "@/logger";
import { exec, spawn } from "child_process";
import { NextFunction, Request, Response } from "express";
import tokenGenerator, { JWT_EXPIRES } from "@/tokenGenerator";
import { LoginResponse, User } from "@/types";
import { readFile } from "fs/promises";
import { promisify } from "util";
import { ServiceError } from "@/errors";

const execAsync = promisify(exec);

export async function login(req: Request, res: Response<LoginResponse>, next: NextFunction) {
    const { username, password } = req.body;
    try {
        if (!isValidUsername(username)) {
            throw new ServiceError("Invalid username format", { username }, 400);
        }
        if (! await checkSudo(username)) {
            throw new ServiceError("User does not have required privileges", { username }, 403);
        }
        if (! await checkPassword(username, password)) {
            throw new ServiceError("Authentication failed. Invalid credentials.", { username }, 401);
        }

        const user: User = { username };
        const token = await tokenGenerator.sign({ user });
        return res.json({ token, expiresInSec: JWT_EXPIRES });
    } catch (error) {
        next(error);
    }
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
