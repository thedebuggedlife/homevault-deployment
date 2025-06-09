import winston from "winston";
import { logger as rootLog } from "@/logger";
import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { SystemResources } from "@/types";
import si from "systeminformation";
import _ from "lodash";
import { EmitterMixin, EventsMap } from "nanoevents";
import kill from "tree-kill";
import { ServiceError } from "@/errors";

export interface CommandResult<T = void> {
    output?: string;
    data?: T;
}

export interface InputEvents extends EventsMap {
    data: (data: string) => void;
    close: () => void;
}

export interface CommandOptions extends SpawnOptions {
    jsonOutput?: boolean;
    jsonArray?: boolean;
    sudo?: { password: string };
    stdin?: EmitterMixin<InputEvents>;
    stdout?: (data: string) => void;
    stderr?: (data: string) => void;
}

export interface Cancellable<T> {
    promise: Promise<T>;
    cancel: () => void;
}

export class ProcessError {
    pid?: number;
    code?: number;
}

class SystemService {
    private logger: winston.Logger;

    constructor() {
        this.logger = rootLog.child({ source: 'SystemService' });
    }

    async getStatus(): Promise<SystemResources> {
        const cpu = await si.currentLoad();
        const memory = await si.mem();
        const diskSize = await si.fsSize();
        const rootDisk = diskSize.find(fs => fs.mount === '/') || _.first(diskSize);
        return {
            cpuLoad: cpu.avgLoad,
            memoryTotal: memory.total,
            memoryUsage: memory.used,
            diskTotal: rootDisk?.size ?? 0,
            diskUsage: rootDisk?.used ?? 0,
        }
    }

    executeCommand<T = void>(
        command: string,
        args: string[] = [],
        options: CommandOptions = {}
    ): Cancellable<CommandResult<T>> {
        let process: ChildProcess;
        const promise = new Promise<CommandResult<T>>((resolve, reject) => {
            try {
                options = {
                    ...options,
                    shell: true,
                }

                process = spawn(command, args, options);
                this.logger.info(`Process [${process.pid}] started with command: ${command} ${args.join(" ")}`);

                let output: string = "";
                let error: string = "";

                process.stdout?.on("data", (data: Buffer) => {
                    const text = data.toString();
                    options?.stdout?.(text)
                    output += text;
                });

                process.stderr?.on("data", (data: Buffer) => {
                    const text = data.toString();
                    options?.stderr?.(text);
                    error += text;
                });

                if (options.stdin) {
                    options.stdin.on("data", data => {
                        process.stdin?.write(data);
                    });
                    options.stdin.on("close", () => {
                        process.stdin?.end();
                    })
                }

                process.on("error", (error) => {
                    this.logger.error(`Process [${process.pid}] failed to start`, { command, args, options, error });
                    reject(new ServiceError("Process failed to start", { command, args, options, error }));
                })

                process.on("close", (code: number | undefined) => {
                    let data: T | undefined;
                    if (options.jsonOutput) {
                        data = this.tryParseJson<T>(output, options.jsonArray);
                    }
                    const result = { data, output };
                    this.logger.info(`Process [${process.pid}] exits with code ${code}`);
                    if (code === 0) {
                        resolve(result);
                    } else {
                        reject(new ServiceError(`Process exited with code ${code}`, { result }));
                    }
                });
            } catch (error) {
                this.logger.error("Failed to spawn new process", { command, args, options, error });
                reject(new ServiceError("Failed to spawn new process", { command, args, options, error }));
            }
        });
        const cancel = () => {
            this.logger.warn(`Sending SIGINT signal to process: [${process?.pid}]`);
            if (process.pid) {
                kill(process.pid, "SIGINT", err => {
                    if (err) {
                        this.logger.error(`Failed to send SIGINT signal to process: [${process.pid}]`, err);
                    }
                })
            }
        }
        return { promise, cancel };
    }

    tryParseJson<T>(data: string, asArray?: boolean): T | undefined {
        try {
            if (asArray) {
                const lines = data.trim().split('\n').filter(line => line.trim());
                return lines.map(line => JSON.parse(line)) as T;
            }
            return JSON.parse(data);
        } catch (err) {
            this.logger.warn("Failed to parse command output", { data, err });
        }
    }
}

export default new SystemService();