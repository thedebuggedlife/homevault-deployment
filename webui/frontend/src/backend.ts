import config from "@/config";
import {
    RefreshResponse,
    CurrentActivity,
    DeploymentClientEvents,
    DeploymentConfig,
    DeploymentRequest,
    DeploymentServerEvents,
    GetModulesResponse,
    LoginResponse,
    SystemStatusResponse,
} from "@backend/types";
import { BackupStatus, BackupSnapshot, BackupSchedule, BackupInitRequest } from "@backend/types/backup";
import axios, { AxiosRequestConfig } from "axios";
import { createNanoEvents, EmitterMixin } from "nanoevents";
import { io, Socket } from "socket.io-client";

type DeploymentSocket = Socket<DeploymentServerEvents, DeploymentClientEvents>;

export interface DeploymentOperationEvents {
    backfill: (data: string[]) => void;
    output: (data: string, offset: number) => void;
    completed: () => void;
    error: (message: string) => void;
    closed: () => void;
}

export class DeploymentOperation implements EmitterMixin<DeploymentOperationEvents> {
    private readonly emitter = createNanoEvents<DeploymentOperationEvents>();
    private completed = false;

    constructor(
        private socket: DeploymentSocket,
        public id?: string
    ) {
        socket.on("disconnect", () => {
            if (!this.completed) {
                this.completed = true;
                this.emitter.emit("error", "Disconnected from backend");
            }
            this.close();
        });
        socket.on("started", (id) => (this.id = id));
        socket.on("completed", () => {
            this.completed = true;
            this.emitter.emit("completed");
            this.close();
        });
        socket.on("error", (error) => {
            console.error("Received `error` event from server", error);
            this.completed = true;
            this.emitter.emit("error", error);
            this.close();
        });
        socket.on("output", (data, offset) => {
            this.emitter.emit("output", data, offset);
        });
        socket.on("backfill", (data) => {
            this.emitter.emit("backfill", data);
        });
    }

    get isInstalling(): boolean {
        return !this.completed;
    }

    abort() {
        this.socket.emit("abort");
    }

    close() {
        this.emitter.emit("closed");
        this.emitter.events = {};
        try {
            this.socket?.disconnect();
            delete this.socket;
        } catch (error) {
            console.error("Failed to disconnect socket", error);
        }
    }

    on<E extends keyof DeploymentOperationEvents>(event: E, callback: DeploymentOperationEvents[E]) {
        if (this.completed) {
            throw new Error("The operation has completed previously");
        }
        return this.emitter.on(event, callback);
    }
}

interface BackendServerEvents {
    deployment: (operation: DeploymentOperation) => void;
}

class BackendServer implements EmitterMixin<BackendServerEvents> {
    private token: string;
    private readonly client = axios.create({
        baseURL: config.backendUrl,
    });
    private readonly emitter = createNanoEvents<BackendServerEvents>();
    on<E extends keyof BackendServerEvents>(event: E, callback: BackendServerEvents[E]) {
        return this.emitter.on(event, callback);
    }
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await this.client.post<LoginResponse>("/api/login", {
            username,
            password,
        });
        if (!response.data?.token) {
            throw new Error("login() response is missing token");
        }
        this.setToken(response.data.token);
        return response.data;
    }
    async refreshToken(token: string): Promise<RefreshResponse> {
        const reqConfig: AxiosRequestConfig = {};
        reqConfig.headers = {
            Authorization: `Bearer ${token}`,
        };
        const response = await this.client.post<RefreshResponse>("/api/token/refresh", null, reqConfig);
        this.setToken(response.data.token ?? token);
        return response.data;
    }
    async logout() {
        this.setToken();
    }
    async getStatus(): Promise<SystemStatusResponse> {
        const response = await this.client.get<SystemStatusResponse>("/api/status");
        return response.data;
    }
    async getModules(): Promise<GetModulesResponse> {
        const response = await this.client.get<GetModulesResponse>("/api/modules");
        return response.data;
    }
    async getCurrentActivity(): Promise<CurrentActivity> {
        const response = await this.client.get<CurrentActivity>("/api/activity");
        return response.data;
    }
    async getDeploymentConfig(request: DeploymentRequest): Promise<DeploymentConfig> {
        const response = await this.client.post<DeploymentConfig>("/api/deployment/config", request);
        return response.data;
    }
    async getBackupStatus(): Promise<BackupStatus> {
        const response = await this.client.get<BackupStatus>("/api/backup/status");
        return response.data;
    }
    async initBackupRepository(request: BackupInitRequest): Promise<void> {
        // TODO: Replace with actual API call
        // await this.client.post("/api/backup/init", request);

        console.log("Mock: Initializing backup repository", request);
        return Promise.resolve();
    }
    async getBackupSnapshots(): Promise<BackupSnapshot[]> {
        const response = await this.client.get<BackupSnapshot[]>("/api/backup/snapshots");
        return response.data;
    }
    async deleteBackupSnapshot(id: string): Promise<void> {
        // TODO: Replace with actual API call
        // await this.client.delete(`/api/backup/snapshots/${id}`);

        console.log("Mock: Deleting snapshot", id);
        return Promise.resolve();
    }
    async getBackupSchedule(): Promise<BackupSchedule> {
        // TODO: Replace with actual API call
        // const response = await this.client.get<BackupSchedule>("/api/backup/schedule");
        // return response.data;

        // Mock data for development
        return {
            enabled: true,
            cronExpression: "0 2 * * *",
            retentionPolicy: "7d4w12m",
        };
    }
    async updateBackupSchedule(schedule: BackupSchedule): Promise<void> {
        // TODO: Replace with actual API call
        // await this.client.post("/api/backup/schedule", schedule);

        console.log("Mock: Updating backup schedule", schedule);
        return Promise.resolve();
    }
    async startBackup(): Promise<DeploymentOperation> {
        // TODO: Replace with actual implementation
        // This will need to connect to a backup-specific WebSocket endpoint

        console.log("Mock: Starting backup");
        // For now, throw an error to indicate this is not implemented
        throw new Error("Backup operation not yet implemented");
    }
    async startDeployment(request: DeploymentRequest): Promise<DeploymentOperation> {
        const socket = await this.connectDeployment();
        const operation = new DeploymentOperation(socket);
        socket.emit("start", request);
        this.emitter.emit("deployment", operation);
        return operation;
    }
    async attachDeployment(id: string): Promise<DeploymentOperation> {
        const socket = await this.connectDeployment();
        const operation = new DeploymentOperation(socket, id);
        socket.emit("attach", id);
        return operation;
    }
    private connectDeployment(): Promise<DeploymentSocket> {
        try {
            const url = config.backendUrl + "/deployment";
            const socket: Socket<DeploymentServerEvents, DeploymentClientEvents> = io(url, {
                path: "/socket.io",
                auth: {
                    token: this.token,
                },
            });
            return new Promise<DeploymentSocket>((resolve, reject) => {
                socket.on("connect", () => {
                    resolve(socket);
                });
                socket.on("connect_error", (error) => {
                    reject(error);
                });
            });
        } catch (error) {
            console.error("Failed to connect websocket for deployment", error);
            return Promise.reject(error);
        }
    }
    private setToken(token?: string) {
        if (token) {
            this.token = token;
            this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } else {
            delete this.token;
            delete this.client.defaults.headers.common["Authorization"];
        }
    }
}

export default new BackendServer();
