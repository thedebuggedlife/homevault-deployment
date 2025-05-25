import winston from "winston";
import { logger as rootLog } from "@/logger";
import system from "./system";

export const INSTALLER_PATH = process.env.INSTALLER_PATH ?? "~/homevault/workspace";

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

    async getVersion(): Promise<string> {
        const output = await this.executeCommand("-v");
        return output?.version ?? "";
    }

    async getInstalledModules(): Promise<string[]> {
        const output = await this.executeCommand("modules");
        return output?.modules?.installed ?? [];
    }

    // async getAvailableModules(): Promise<Module[]> {
    //     try {
    //         const result = await system.executeCommand("ls", ["setup/modules"]);
    //         if (!result.output) {
    //             return [];
    //         }
    //         return result.output
    //             .split("\n")
    //             .filter((module) => module && module !== "base")
    //             .map((module) => ({
    //                 name: module,
    //                 description: this.getModuleDescription(module),
    //             }));
    //     } catch (error) {
    //         this.logger.error("Failed to get available modules:", error);
    //         throw error;
    //     }
    // }

    // getModuleDescription(moduleName: string): string {
    //     try {
    //         const helpPath = path.join(process.cwd(), "setup/modules", moduleName, "help.txt");
    //         return fs.readFileSync(helpPath, "utf8");
    //     } catch (error) {
    //         return "No description available";
    //     }
    // }

    // async installModule(moduleName: string, options: InstallOptions = {}): Promise<CommandResult> {
    //     const args = ["setup/hv", "--module", moduleName];

    //     if (options.unattended) {
    //         args.push("--unattended");
    //     }

    //     if (options.dryRun) {
    //         args.push("--dry-run");
    //     }

    //     try {
    //         const result = await system.executeCommand("sudo", args);
    //         return result;
    //     } catch (error) {
    //         this.logger.error(`Failed to install module ${moduleName}:`, error);
    //         throw error;
    //     }
    // }

    // async backupSystem(options: InstallOptions = {}): Promise<CommandResult> {
    //     const args = ["setup/hv", "--backup"];

    //     if (options.dryRun) {
    //         args.push("--dry-run");
    //     }

    //     try {
    //         const result = await system.executeCommand("sudo", args);
    //         return result;
    //     } catch (error) {
    //         this.logger.error("Failed to backup system:", error);
    //         throw error;
    //     }
    // }

    // async restoreSystem(backupPath: string, options: InstallOptions = {}): Promise<CommandResult> {
    //     const args = ["setup/hv", "--restore", backupPath];

    //     if (options.dryRun) {
    //         args.push("--dry-run");
    //     }

    //     try {
    //         const result = await system.executeCommand("sudo", args);
    //         return result;
    //     } catch (error) {
    //         this.logger.error("Failed to restore system:", error);
    //         throw error;
    //     }
    // }

    private async executeCommand(...args: string[]): Promise<InstallerOutput|undefined> {
        try {
            const command = await system.executeCommand<InstallerOutput>("bash", ["hv", "--json", ...args], {
                cwd: INSTALLER_PATH,
                jsonOutput: true,
            });
            if (!command.data) {
                this.logger.error("Installer command did not return valid data", {
                    args
                });
            }
            return command.data;
        } catch (error) {
            this.logger.error("Failed to execute installer command", {
                args,
                error
            });
        }
    }
}

export default new InstallerService();
