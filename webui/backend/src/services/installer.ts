import winston from "winston";
import { logger as rootLog } from "@/logger";
import system, { Cancellable, CommandResult, InputEvents } from "./system";
import { CurrentActivity, DeploymentConfig, DeploymentRequest } from "@/types";
import { createNanoEvents, Emitter, EmitterMixin } from "nanoevents";
import { ServiceError } from "@/errors";
import { v4 as uuid } from "uuid";
import { file } from 'tmp-promise';
import * as fs from "fs/promises";

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
    cancellable?: boolean;
}

export interface DeploymentEvents {
    output: (data: string, offset: number) => void;
    completed: (error?: any) => void;
}

export interface DeploymentInstance {
    id: string;
    request: DeploymentRequest;
    events: Emitter<DeploymentEvents>;
    output: string[];
    abort?: () => void;
}

interface ConfigFile {
    path: string;
    cleanup: () => Promise<void>;
}

class InstallerService {
    private logger: winston.Logger;
    private currentDeployment?: DeploymentInstance;

    constructor() {
        this.logger = rootLog.child({ source: "InstallerService" });
    }

    getCurrentActivity(): CurrentActivity | undefined {
        if (this.currentDeployment) {
            return {
                id: this.currentDeployment.id,
                type: "deployment",
                request: this.currentDeployment.request,
            };
        }
    }

    getCurrentDeployment(): DeploymentInstance | undefined {
        return this.currentDeployment;
    }

    async getVersion(): Promise<string> {
        const output = await this.executeCommand(["-v"]);
        return output?.version ?? "";
    }

    async getInstalledModules(): Promise<string[]> {
        const output = await this.executeCommand(["modules"]);
        return output?.modules?.installed ?? [];
    }

    async getAvailableModules(): Promise<Record<string, string>> {
        const output = await this.executeCommand(["modules", "--all"]);
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

    async startDeployment(request: DeploymentRequest): Promise<DeploymentInstance> {
        if (this.currentDeployment) {
            this.logger.warn("There is already an ongoing deployment");
            throw new ServiceError("There is already an ongoing deployment");
        }
        const password = request.config?.password;
        if (!password) {
            this.logger.warn("Deployment request missing password for sudo");
            throw new ServiceError("Deployment requires password for sudo");
        }
        delete request.config?.password; // Avoid leaking password - remove it from persisted request
        const input = createNanoEvents<InputEvents>();
        const instance: DeploymentInstance = (this.currentDeployment = {
            id: uuid(),
            request,
            events: createNanoEvents<DeploymentEvents>(),
            output: [],
        });
        const args = this.getDeploymentArgs(request);
        const output = (data: string) => {
            if (data.startsWith("[sudo]")) {
                input.emit("data", password + "\n");
            }
            instance.events.emit("output", data, instance.output.length);
            instance.output.push(data);
        };
        const variables = request.config?.variables ?? {};
        let configFile: ConfigFile;
        if (Object.entries(variables).length > 0) {
            configFile = await this.generateConfFile(variables);
            args.push("--override", configFile.path);
        }
        const cancellable = this.executeCommand([...args, "--unattended", "--force"], {
            output,
            input,
            cancellable: true,
        });
        cancellable.promise
            .then(
                () => {
                    // Delete current deployment first to avoid race conditions when attaching to ongoing deployment
                    delete this.currentDeployment;
                    instance.events.emit("completed");
                },
                (error) => {
                    // Delete current deployment first to avoid race conditions when attaching to ongoing deployment
                    delete this.currentDeployment;
                    instance.events.emit("completed", error);
                }
            )
            .finally(() => {
                input.events = {};
                instance.events.events = {};
                configFile?.cleanup();
            });
        instance.abort = () => {
            this.logger.warn("Cancelling deployment instance: " + instance.id);
            cancellable.cancel();
        };
        return instance;
    }

    private async generateConfFile(config: Record<string,string>): Promise<ConfigFile> {
        const { path, cleanup } = await file();

        this.logger.info("Created temporary file: " + path);
        const content = Object.entries(config)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const fileHandle = await fs.open(path, 'w');
        try {
            await fileHandle.write(content, 0, 'utf8');
        } finally {
            await fileHandle.close();
        }

        return { path, cleanup };
    }

    private getDeploymentArgs(request: DeploymentRequest) {
        const args = ["deploy"];
        request?.modules?.install?.forEach((m) => {
            args.push("-m", m);
        });
        request?.modules?.remove?.forEach((m) => {
            args.push("--rm", m);
        });
        return args;
    }

    private executeCommand(
        args: string[],
        options: CommandOptions & { cancellable: true }
    ): Cancellable<CommandResult<InstallerOutput>>;

    private executeCommand(
        args: string[],
        options?: CommandOptions & { cancellable?: false | undefined }
    ): Promise<InstallerOutput | undefined>;

    private executeCommand(
        args: string[],
        options?: CommandOptions
    ): Promise<InstallerOutput | undefined> | Cancellable<CommandResult<InstallerOutput>> {
        let lastError: string | undefined;
        try {
            const jsonOutput = !options?.output;
            if (jsonOutput) {
                args.unshift("--json");
            }
            args.unshift("hv");
            const cancellable = system.executeCommand<InstallerOutput>("bash", args, {
                cwd: INSTALLER_PATH,
                jsonOutput,
                stdin: options?.input,
                stdout: options?.output,
                stderr: (data: string) => {
                    const lines = data.split("\n");
                    for (const line of lines) {
                        // TODO: Does not always catch the last error
                        if (line.startsWith("🔴 ERROR: ")) {
                            lastError = data.substring(9);
                        }
                    }
                    options?.output?.(data);
                },
            });
            if (options?.cancellable) {
                return cancellable;
            }
            return cancellable.promise.then(
                (result) => {
                    if (jsonOutput) {
                        if (!result.data) {
                            throw new ServiceError("Installer command did not return valid data", {
                                args: args.join(" "),
                                result,
                            });
                        }
                        return result.data;
                    }
                },
                (error) => {
                    throw new ServiceError(lastError ?? "Failed to execute installer command", { args, error });
                }
            );
        } catch (error) {
            throw new ServiceError("Failed to execute installer command", { args, error });
        }
    }
}

export default new InstallerService();
