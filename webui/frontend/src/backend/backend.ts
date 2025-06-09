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
    SessionServerEvents,
} from "@backend/types";
import { BackupStatus, BackupSnapshot, BackupSchedule, BackupInitRequest } from "@backend/types/backup";
import axios, { AxiosRequestConfig } from "axios";
import { createNanoEvents, EmitterMixin } from "nanoevents";
import { io, Socket } from "socket.io-client";
import { type DeploymentSocket, DeploymentOperation } from "./deployment";

export type SessionSocket = Socket<SessionServerEvents>;

export class SessionConnection {
    private socket?: SessionSocket;

    disconnect() {
        this.socket?.disconnect();
        delete this.socket;
    }
}
interface BackendServerEvents {
    deployment: (operation: DeploymentOperation) => void;
}

class BackendServer implements EmitterMixin<BackendServerEvents> {
    private token?: string;
    private sessionId?: string;
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
        await this.client.post("/api/backup/init", request);

        console.log("Mock: Initializing backup repository", request);
        return Promise.resolve();
    }
    async getBackupSnapshots(): Promise<BackupSnapshot[]> {
        const response = await this.client.get<BackupSnapshot[]>("/api/backup/snapshots");
        return response.data;
    }
    async deleteBackupSnapshot(id: string): Promise<void> {
        await this.client.delete(`/api/backup/snapshots/${id}`);
    }
    async updateBackupSchedule(schedule: BackupSchedule): Promise<void> {
        await this.client.post("/api/backup/schedule", schedule);
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
    connectSession(): SessionSocket {
        const url = config.backendUrl + "/session";
        const socket: SessionSocket = io(url, {
            auth: {
                token: this.token,
            },
        });
        socket.on("hello", (sessionId: string) => {
            console.info("Received session ID: " + sessionId);
            this.sessionId = sessionId;
            this.client.defaults.params = { sessionId };
        });
        socket.on("disconnect", (reason) => {
            console.warn("Session socket disconnected due to " + reason);
            delete this.sessionId;
            delete this.client.defaults.params;
        });
        return socket;
    }
    private connectDeployment(): Promise<DeploymentSocket> {
        try {
            const url = config.backendUrl + "/deployment";
            const socket: Socket<DeploymentServerEvents, DeploymentClientEvents> = io(url, {
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
