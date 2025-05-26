import winston from "winston";
import { logger as rootLog } from "@/logger";
import system from "./system";
import { DeploymentConfig, DeploymentRequest } from "@/types";

export const INSTALLER_PATH = process.env.INSTALLER_PATH ?? "~/homevault/workspace";

interface InstallerOutput {
    version: string;
    modules?: {
        installed?: string[];
        available?: Record<string, string>;
    };
    config?: DeploymentConfig;
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

    async getAvailableModules(): Promise<Record<string, string>> {
        const output = await this.executeCommand("modules", "--all");
        return output?.modules?.available ?? {};
    }

    async getDeploymentConfig(request: DeploymentRequest): Promise<DeploymentConfig> {
        const args = this.getDeploymentArgs(request);
        const output = await this.executeCommand("deploy", "--webui-config", ...args);
        if (!output?.config) {
            throw new Error("Invalid command line output received");
        }
        return output.config;
    }

    private getDeploymentArgs(request: DeploymentRequest) {
        const args: string[] = [];
        request?.modules?.install?.forEach(m => {
            args.push("-m", m);
        });
        request?.modules?.remove?.forEach(m => {
            args.push("--rm", m);
        });
        return args;
    }

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
