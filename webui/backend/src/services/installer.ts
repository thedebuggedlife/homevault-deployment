import winston from "winston";
import { logger as rootLog } from "@/logger";
import system, { Cancellable, CommandResult, InputEvents } from "./system";
import { CurrentActivity, DeploymentConfig, DeploymentRequest } from "@/types";
import { createNanoEvents, Emitter, EmitterMixin } from "nanoevents";
import { ServiceError } from "@/errors";
import { v4 as uuid } from "uuid";
import { file } from "tmp-promise";
import * as fs from "fs/promises";
import { BackupStatus, RepositoryType } from "@/types/backup";
import _ from "lodash";

export const INSTALLER_PATH = process.env.INSTALLER_PATH ?? "~/homevault/workspace";

interface SnapshotOutput {
    time: string;
    tags: string[],
    summary: {
        backupStart: string;
        backupEnd: string;
        filesNew: number;
        filesChanged: number;
        filesUnmodified: number;
        dirsNew: number;
        dirsChanged: number;
        dirsUnmodified: number;
        dataAdded: number;
        dataAddedPacked: number;
        totalFilesProcessed: number;
        totalBytesProcessed: number;
    }
}

interface BackupOutput {
    env: Record<string, string>;
    stats: {
        totalSize: number;
        totalUncompressedSize: number;
        compressionRatio: number;
        compressionProgress: number;
        compressionSpaceSaving: number;
        totalBlobCount: number;
        snapshotsCount: number;
        lastSnapshotTime: string;
    };
    schedule?: {
        enabled: boolean;
        cron: string;
        retention: string;
    };
    snapshots?: SnapshotOutput[];
}

interface InstallerOutput {
    version: string;
    modules?: {
        installed?: string[];
        available?: Record<string, string>;
    };
    config?: DeploymentConfig;
    backup?: BackupOutput;
    logs: string[];
}

interface CommandOptions {
    output?: (data: string) => void;
    input?: EmitterMixin<InputEvents>;
    cancellable?: boolean;
    env?: Record<string, string>;
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
    sudo: () => string;
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

    sudoForActivity(id: string): string {
        if (this.currentDeployment) {
            if (this.currentDeployment.id !== id) {
                throw new ServiceError("The activity current activity id does not match the sudo request", null, 403);
            }
            return this.currentDeployment.sudo();
        }
        throw new ServiceError("There is no activity that requires sudo access", null, 400);
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
        const args = ["webui", "config", ...this.getDeploymentArgs(request)];
        const output = await this.executeCommand(args);
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
        const instance: DeploymentInstance = (this.currentDeployment = {
            id: uuid(),
            request,
            events: createNanoEvents<DeploymentEvents>(),
            output: [],
            sudo: () => password,
        });
        const args = ["deploy", ...this.getDeploymentArgs(request)];
        const output = (data: string) => {
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
            cancellable: true,
            env: {
                ...process.env,
                SUDO_NONCE: instance.id,
                SUDO_ASKPASS: `${INSTALLER_PATH}/webui/backend/askpass.sh`,
            },
        });
        this.logger.info(`Deployment instance ${instance.id} started`);
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
                instance.events.events = {};
                configFile?.cleanup();
            });
        instance.abort = () => {
            this.logger.warn("Cancelling deployment instance: " + instance.id);
            cancellable.cancel();
        };
        return instance;
    }

    async getBackupStatus(): Promise<BackupStatus> {
        try {
            const { backup } = (await this.executeCommand(["backup info"])) || {};
            if (!backup) {
                this.logger.warn("Empty restic object returned - assuming system is uninitialized");
                return { initialized: false };
            }
            const repositoryLocation = backup.env["RESTIC_REPOSITORY"];
            if (_.isEmpty(repositoryLocation)) {
                return { initialized: false };
            }
            let repositoryType: RepositoryType = "unknown";
            if (repositoryLocation.startsWith("/")) {
                repositoryType = "local";
            } else if (repositoryLocation.startsWith("s3:")) {
                repositoryType = "s3";
            } else if (repositoryLocation.startsWith("azure:")) {
                repositoryType = "azure";
            } else if (repositoryLocation.startsWith("gs:")) {
                repositoryType = "gs";
            } else if (repositoryLocation.startsWith("sftp:")) {
                repositoryType = "sftp";
            } else if (repositoryLocation.startsWith("rest:")) {
                repositoryType = "rest";
            }
            return {
                initialized: true,
                repositoryType,
                repositoryLocation,
                snapshotCount: backup.stats.snapshotsCount,
                totalSize: backup.stats.totalSize,
                totalUncompressedSize: backup.stats.totalUncompressedSize,
                schedulingEnabled: backup.schedule?.enabled ?? false,
                scheduleExpression: backup.schedule?.cron,
                retentionPolicy: backup.schedule?.retention,
                lastBackupTime: backup.stats.lastSnapshotTime,
            }
        } catch (error) {
            this.logger.warn("Could not get backup information - assuming system is uninitialized");
            return { initialized: false };
        }
    }

    private async generateConfFile(config: Record<string, string>): Promise<ConfigFile> {
        const { path, cleanup } = await file();

        this.logger.info("Created temporary file: " + path);
        const content = Object.entries(config)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        const fileHandle = await fs.open(path, "w");
        try {
            await fileHandle.write(content, 0, "utf8");
        } finally {
            await fileHandle.close();
        }

        return { path, cleanup };
    }

    private getDeploymentArgs(request: DeploymentRequest) {
        const args: string[] = [];
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
                env: options?.env,
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
