import winston from "winston";
import { logger as rootLog } from "@/logger";
import { ChildProcess, spawn, SpawnOptionsWithoutStdio } from "child_process";
import { SystemResources } from "@/types";
import si from "systeminformation";
import _ from "lodash";

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

                process.on("error", (error) => {
                    this.logger.error("Failed to spawn new process", { command, args, options, error });
                    reject({ success: false, error: "Failed to spawn new process" });
                })

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
                this.logger.info(`Parsing output as array from ${lines.length} lines`);
                return lines.map(line => JSON.parse(line)) as T;
            }
            return JSON.parse(data);
        } catch (err) {
            this.logger.warn("Failed to parse command output", { data, err });
        }
    }
}

export default new SystemService();