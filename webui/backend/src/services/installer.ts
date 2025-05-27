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
            throw new ServiceError("Invalid output received from installer", { request, output });
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
            args = ["hv", "--json", ...args];
            this.logger.info("Executing command: " + args.join(' '));
            const result = await system.executeCommand<InstallerOutput>("bash", args, {
                cwd: INSTALLER_PATH,
                jsonOutput: true,
            });
            if (!result.data) {
                throw new ServiceError("Installer command did not return valid data", { args: args.join(' '), result });
            }
            return result.data;
        } catch (error) {
            throw new ServiceError("Failed to execute installer command", { args });
        }
    }
}

export default new InstallerService();
