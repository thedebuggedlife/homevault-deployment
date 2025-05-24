import { spawn, ChildProcess, SpawnOptionsWithoutStdio } from "child_process";
import path from "path";
import fs from "fs";
import winston from "winston";
import { logger as rootLog } from "@/logger";
import { DockerContainer, SystemStatus } from "@/types/installer";

export const INSTALLER_PATH = process.env.INSTALLER_PATH ?? "~/homevault/workspace";

interface CommandResult<T = void> {
    success: boolean;
    output?: string;
    error?: string;
    data?: T;
    code?: number;
}

interface CommandOptions extends SpawnOptionsWithoutStdio {
    jsonOutput?: boolean;
    jsonArray?: boolean;
}

interface Module {
    name: string;
    description: string;
}

interface InstallOptions {
    unattended?: boolean;
    dryRun?: boolean;
}

interface InstallerOutput {
    version: string;
    modules?: {
        installed?: string[];
        available?: Record<string, string>;
    };
    logs: string[];
}

class InstallerService {
    private logger: winston.Logger;

    constructor() {
        this.logger = rootLog.child({ source: 'InstallerService' });
    }

    async executeCommand<T = void>(
        command: string,
        args: string[] = [],
        options: CommandOptions = {}
    ): Promise<CommandResult<T>> {
        return new Promise((resolve, reject) => {
            options = {
                ...options,
                cwd: INSTALLER_PATH,
                shell: true,
            }
            this.logger.debug("Spanning new process", {
                command, args, options
            })
            const process: ChildProcess = spawn(command, args, options);

            let output: string = "";
            let error: string = "";

            process.stdout?.on("data", (data: Buffer) => {
                output += data.toString();
            });

            process.stderr?.on("data", (data: Buffer) => {
                error += data.toString();
            });

            process.on("close", (code: number | undefined) => {
                let data: T | undefined;
                if (options.jsonOutput) {
                    data = this.tryParseJson<T>(output, options.jsonArray);
                }
                const result = { success: code == 0, data, output, error, code };
                if (code === 0) {
                    resolve(result);
                } else {
                    reject(result);
                }
            });
        });
    }

    async getAvailableModules(): Promise<Module[]> {
        try {
            const result = await this.executeCommand("ls", ["setup/modules"]);
            if (!result.output) {
                return [];
            }
            return result.output
                .split("\n")
                .filter((module) => module && module !== "base")
                .map((module) => ({
                    name: module,
                    description: this.getModuleDescription(module),
                }));
        } catch (error) {
            this.logger.error("Failed to get available modules:", error);
            throw error;
        }
    }

    tryParseJson<T>(data: string, asArray?: boolean): T | undefined {
        try {
            if (asArray) {
                const lines = data.trim().split('\n').filter(line => line.trim());
                this.logger.info(`Parsing output as array from ${lines.length} lines`);
                return lines.map(line => JSON.parse(line)) as T;
            }
            return JSON.parse(data);
        } catch (err) {
            this.logger.warn("Failed to parse command output", { data, err });
        }
    }

    getModuleDescription(moduleName: string): string {
        try {
            const helpPath = path.join(process.cwd(), "setup/modules", moduleName, "help.txt");
            return fs.readFileSync(helpPath, "utf8");
        } catch (error) {
            return "No description available";
        }
    }

    async installModule(moduleName: string, options: InstallOptions = {}): Promise<CommandResult> {
        const args = ["setup/hv", "--module", moduleName];

        if (options.unattended) {
            args.push("--unattended");
        }

        if (options.dryRun) {
            args.push("--dry-run");
        }

        try {
            const result = await this.executeCommand("sudo", args);
            return result;
        } catch (error) {
            this.logger.error(`Failed to install module ${moduleName}:`, error);
            throw error;
        }
    }

    async getSystemStatus(): Promise<SystemStatus> {
        try {
            const [dockerStatus, moduleStatus] = await Promise.all([
                this.executeCommand<DockerContainer[]>("docker", ["compose", "-p", "homevault", "ps", "--format", "json"], {
                    jsonOutput: true,
                    jsonArray: true,
                }),
                this.executeCommand<InstallerOutput>("bash", ["hv", "modules", "--json"], { jsonOutput: true }),
            ]);

            return {
                docker: dockerStatus.data ?? [],
                installedModules: moduleStatus.data?.modules?.installed ?? [],
            };
        } catch (error) {
            this.logger.error("Failed to get system status:", error);
            throw error;
        }
    }

    async backupSystem(options: InstallOptions = {}): Promise<CommandResult> {
        const args = ["setup/hv", "--backup"];

        if (options.dryRun) {
            args.push("--dry-run");
        }

        try {
            const result = await this.executeCommand("sudo", args);
            return result;
        } catch (error) {
            this.logger.error("Failed to backup system:", error);
            throw error;
        }
    }

    async restoreSystem(backupPath: string, options: InstallOptions = {}): Promise<CommandResult> {
        const args = ["setup/hv", "--restore", backupPath];

        if (options.dryRun) {
            args.push("--dry-run");
        }

        try {
            const result = await this.executeCommand("sudo", args);
            return result;
        } catch (error) {
            this.logger.error("Failed to restore system:", error);
            throw error;
        }
    }
}

export default new InstallerService();
