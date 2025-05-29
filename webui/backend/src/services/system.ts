import winston from "winston";
import { logger as rootLog } from "@/logger";
import { ChildProcess, spawn, SpawnOptionsWithoutStdio } from "child_process";
import { SystemResources } from "@/types";
import si from "systeminformation";
import _ from "lodash";
import { EmitterMixin, EventsMap } from "nanoevents";

export interface CommandResult<T = void> {
    success: boolean;
    output?: string;
    error?: string;
    data?: T;
    code?: number;
}

export interface InputEvents extends EventsMap {
    data: (data: string) => void;
    close: () => void;
}

export interface CommandOptions extends SpawnOptionsWithoutStdio {
    jsonOutput?: boolean;
    jsonArray?: boolean;
    sudo?: { password: string };
    stdin?: EmitterMixin<InputEvents>;
    stdout?: (data: string) => void;
    stderr?: (data: string) => void;
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

    async executeCommand<T = void>(
        command: string,
        args: string[] = [],
        options: CommandOptions = {}
    ): Promise<CommandResult<T>> {
        return new Promise((resolve, reject) => {
            try {
                options = {
                    ...options,
                    shell: true,
                }

                const process: ChildProcess = spawn(command, args, options);
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
                    reject({ success: false, error: "Failed to spawn new process" });
                })

                process.on("close", (code: number | undefined) => {
                    let data: T | undefined;
                    if (options.jsonOutput) {
                        data = this.tryParseJson<T>(output, options.jsonArray);
                    }
                    const result = { success: code === 0, data, output, error, code };
                    this.logger.info(`Process [${process.pid}] exits with code ${code}`);
                    if (code === 0) {
                        resolve(result);
                    } else {
                        reject(result);
                    }
                });
            } catch (error) {
                this.logger.error("Failed to spawn new process", { command, args, options, error });
                reject({ success: false, error: "Failed to spawn new process" });
            }
        });
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