import winston from "winston";
import { logger as rootLog } from "@/logger";
import system, { InputEvents } from "./system";
import { DeploymentConfig, DeploymentRequest } from "@/types";
import { createNanoEvents, Emitter, EmitterMixin } from "nanoevents";
import { ServiceError } from "@/errors";

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

interface CommandOptions {
    output?: (data: string) => void;
    input?: EmitterMixin<InputEvents>;
}

export interface DeploymentEvents {
    output: (data: string) => void;
}

export interface DeploymentInstance {
    request: DeploymentRequest;
    events: Emitter<DeploymentEvents>;
}

class InstallerService {
    private logger: winston.Logger;
    private currentDeployment?: DeploymentInstance

    constructor() {
        this.logger = rootLog.child({ source: 'InstallerService' });
    }

    getCurrentDeployment(): DeploymentInstance | undefined {
        return this.currentDeployment;
    }

    async getVersion(): Promise<string> {
        const output = await this.executeCommand([ "-v" ]);
        return output?.version ?? "";
    }

    async getInstalledModules(): Promise<string[]> {
        const output = await this.executeCommand([ "modules" ]);
        return output?.modules?.installed ?? [];
    }

    async getAvailableModules(): Promise<Record<string, string>> {
        const output = await this.executeCommand([ "modules", "--all" ]);
        return output?.modules?.available ?? {};
    }

    async getDeploymentConfig(request: DeploymentRequest): Promise<DeploymentConfig> {
        const args = this.getDeploymentArgs(request);
        const output = await this.executeCommand([...args, "--webui-config"]);
        if (!output?.config) {
            throw new ServiceError("Invalid output received from installer", { request, output });
        }
        return output.config;
    }

    async startDeployment(request: DeploymentRequest): Promise<void> {
        if (this.currentDeployment) {
            this.logger.warn("There is already an ongoing deployment");
            throw new ServiceError("There is already an ongoing deployment");
        }
        const password = request.config?.password;
        if (!password) {
            this.logger.warn("Deployment request missing password for sudo");
            throw new ServiceError("Deployment requires password for sudo");
        }
        const events = createNanoEvents<DeploymentEvents>();
        const input = createNanoEvents<InputEvents>();
        this.currentDeployment = { request, events };
        try {
            const args = this.getDeploymentArgs(request);
            const output = (data: string) => {
                if (data.startsWith("[sudo]")) {
                    input.emit("data", password + "\n");
                }
                events.emit('output', data);
            }
            const options = { output, input }
            await this.executeCommand([...args, "--unattended", "--force"], options);
        }
        finally {
            delete this.currentDeployment;
        }
    }

    private getDeploymentArgs(request: DeploymentRequest) {
        const args = [ "deploy" ];
        request?.modules?.install?.forEach(m => {
            args.push("-m", m);
        });
        request?.modules?.remove?.forEach(m => {
            args.push("--rm", m);
        });
        return args;
    }

    private async executeCommand(args: string[], options?: CommandOptions): Promise<InstallerOutput|undefined> {
        let lastError: string|undefined;
        try {
            const jsonOutput = !options?.output;
            if (jsonOutput) {
                args.unshift("--json");
            }
            args.unshift("hv");
            const result = await system.executeCommand<InstallerOutput>("bash", args, {
                cwd: INSTALLER_PATH,
                jsonOutput,
                stdin: options?.input,
                stdout: options?.output,
                stderr: (data: string) => {
                    const lines = data.split('\n');
                    for (const line of lines) {
                        // TODO: Does not always catch the last error
                        if (line.startsWith("🔴 ERROR: ")) {
                            lastError = data.substring(9);
                        }
                    }
                    options?.output?.(data);
                },
            });
            if (jsonOutput) {
                if (!result.data) {
                    throw new ServiceError("Installer command did not return valid data", { args: args.join(' '), result });
                }
                return result.data;
            }
        } catch (error) {
            throw new ServiceError(lastError ?? "Failed to execute installer command", { args, error });
        }
    }
}

export default new InstallerService();
