import winston from "winston";
import { logger as rootLog } from "@/logger";
import system from "./system";
import { DeploymentConfig, DeploymentRequest, ServerActivity, ServerActivityWithoutId } from "@/types";
import { ServiceError } from "@/errors";
import { file } from "tmp-promise";
import * as fs from "fs/promises";
import { BackupSchedule, BackupSnapshot, BackupStatus } from "@/types/backup";
import _ from "lodash";
import { generateRepositoryEnvironment, parseRepositoryEnvironment, ResticRepository } from "@/types/restic";
import { getSessionId } from "@/middleware/context";
import activity from "./activity";

export const INSTALLER_PATH = process.env.INSTALLER_PATH ?? "~/homevault/workspace";

interface SnapshotOutput {
    id: string;
    shortId: string;
    hostname: string;
    username: string;
    paths: string[];
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
    logs?: string[];
    warnings?: string[];
    errors?: {
        message: string;
        stack: string;
    }[];
}

interface CommandOptions {
    output?: (data: string) => void;
    env?: Record<string, string>;
    withActivity?: ServerActivityWithoutId;
}

interface ConfigFile {
    path: string;
    cleanup: () => Promise<void>;
}

class InstallerService {
    private logger: winston.Logger;

    constructor() {
        this.logger = rootLog.child({ source: "InstallerService" });
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

    async startDeployment(request: DeploymentRequest): Promise<ServerActivity> {
        const args = ["deploy", ...this.getDeploymentArgs(request)];
        const variables = request.config?.variables ?? {};
        let configFile: ConfigFile;
        if (Object.entries(variables).length > 0) {
            configFile = await this.generateConfFile(variables);
            args.push("--override", configFile.path);
        }
        const activity = this.executeCommand([...args, "--unattended", "--force"], {
            withActivity: {
                type: "deployment",
                request
            }
        });
        return activity;
    }

    async listSnapshots(snapshotId?: string): Promise<BackupSnapshot[]> {
        try {
            const args = ["snapshots", "list"]
            if (snapshotId) {
                args.push(snapshotId);
            }
            const result = await this.executeCommand(args);
            return result?.backup?.snapshots?.map(snapshot => ({
                id: snapshot.id,
                shortId: snapshot.shortId,
                time: snapshot.time,
                hostname: snapshot.hostname,
                tags: snapshot.tags,
                totalSize: snapshot.summary.totalBytesProcessed,
            })) ?? [];
        }
        catch (error) {
            this.logger.warn("Failed to enumerate snapshots");
            return [];
        }
    }

    async deleteSnapshot(snapshotId: string): Promise<void> {
        const args = ["snapshots", "forget", snapshotId];
        await this.executeCommand(args);
    }

    async getBackupStatus(): Promise<BackupStatus> {
        try {
            const { backup } = (await this.executeCommand(["backup", "info"])) ?? {};
            if (!backup) {
                this.logger.warn("Empty backup object returned - assuming system is uninitialized");
                return { initialized: false };
            }
            const repositoryLocation = backup.env["RESTIC_REPOSITORY"];
            if (_.isEmpty(repositoryLocation)) {
                return { initialized: false };
            }
            const repository = parseRepositoryEnvironment(backup.env);
            return {
                initialized: true,
                repository,
                snapshotCount: backup.stats.snapshotsCount,
                totalSize: backup.stats.totalSize,
                totalUncompressedSize: backup.stats.totalUncompressedSize,
                lastBackupTime: backup.stats.lastSnapshotTime,
                schedule: {
                    enabled: backup.schedule?.enabled ?? false,
                    cronExpression: backup.schedule?.cron,
                    retentionPolicy: backup.schedule?.retention,
                },
                environment: backup.env,
            }
        } catch (error) {
            this.logger.warn("Could not get backup information - assuming system is uninitialized");
            return { initialized: false };
        }
    }

    async initRepository(repository: ResticRepository): Promise<void> {
        const { backup } = (await this.executeCommand(["backup", "info", "--env-only"])) ?? {};
        const newEnv = generateRepositoryEnvironment(repository, backup?.env);
        const { path: envPath, cleanup } = await this.generateConfFile(newEnv);

        try {
            const activity = this.executeCommand(["backup", "init", "--restic-env", envPath], {
                withActivity: {
                    type: "backup_init"
                }
            });
            await activity.promise;
        } catch {
            throw new ServiceError("Failed to initialize restic repository.");
        } finally {
            cleanup();
        }
    }

    async updateSchedule(schedule: BackupSchedule): Promise<void> {
        const { enabled, cronExpression, retentionPolicy } = schedule;
        const args = ["backup", "schedule", "--unattended"];
        if (!enabled) {
            args.push("--disable");
        }
        else {
            args.push("--enable");
            if (cronExpression) {
                args.push("--cron", `'${cronExpression}'`);
            }
            if (retentionPolicy) {
                args.push("--retention", retentionPolicy);
            }
        }
        const activity = this.executeCommand(args, {
            withActivity: {
                type: "backup_update"
            }
        });
        await activity.promise;
    }

    private async generateConfFile(config: Record<string, string>): Promise<ConfigFile> {
        const { path, cleanup } = await file();
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
        options: CommandOptions & { withActivity: ServerActivityWithoutId }
    ): ServerActivity & { promise: Promise<unknown> };

    private executeCommand(
        args: string[],
        options?: CommandOptions & { withActivity?: undefined }
    ): Promise<InstallerOutput | undefined>;

    private executeCommand(
        args: string[],
        options?: CommandOptions
    ): Promise<InstallerOutput | undefined> | ServerActivity & { promise: Promise<unknown> } {
        let lastError: string | undefined;
        let activityId: string|undefined;
        try {
            const jsonOutput = !options?.output && !options?.withActivity;
            if (jsonOutput) {
                args.unshift("--json");
            }
            args.unshift("hv");
            const activityId = options?.withActivity ? activity.onStart(options.withActivity) : null;
            const output = (data: string) => {
                if (activityId) {
                    activity.onOutput(activityId, [data]);
                }
                options?.output?.(data);
            }
            const cancellable = system.executeCommand<InstallerOutput>("bash", args, {
                cwd: INSTALLER_PATH,
                jsonOutput,
                stdout: output,
                stderr: output,
                env: {
                    ...process.env,
                    ...options?.env,
                    SUDO_NONCE: getSessionId(),
                    SUDO_ASKPASS: `${INSTALLER_PATH}/webui/backend/askpass.sh`,
                }
            });
            if (options?.withActivity) {
                cancellable.promise.then(
                    () => {
                        activity.onEnd(activityId!);
                    }, 
                    (error) => {
                        activity.onEnd(activityId!, error);
                    }
                );
                return {
                    ...options.withActivity,
                    id: activityId!,
                    promise: cancellable.promise,
                }
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
            if (activityId) {
                activity.onEnd(activityId, error);
            }
            throw new ServiceError("Failed to execute installer command", { args, error });
        }
    }
}

export default new InstallerService();
