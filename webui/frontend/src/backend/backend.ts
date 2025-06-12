import config from "@/config";
import {
    RefreshResponse,
    ServerActivity,
    DeploymentConfig,
    DeploymentRequest,
    GetModulesResponse,
    LoginResponse,
    SystemStatusResponse,
    SessionServerEvents,
    SessionClientEvents,
    ActivityServerEvents,
    DeploymentResponse,
    ActivityClientEvents,
} from "@backend/types";
import { BackupStatus, BackupSnapshot, BackupSchedule, BackupInitRequest } from "@backend/types/backup";
import axios, { AxiosRequestConfig } from "axios";
import { io, Socket } from "socket.io-client";

export type SessionSocket = Socket<SessionServerEvents, SessionClientEvents>;

export type ActivitySocket = Socket<ActivityServerEvents, ActivityClientEvents>;

export class SessionConnection {
    private socket?: SessionSocket;

    disconnect() {
        this.socket?.disconnect();
        delete this.socket;
    }
}

class BackendServer {
    private token?: string;
    private sessionId?: string;
    private readonly client = axios.create({
        baseURL: config.backendUrl,
    });
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
    async getCurrentActivity(): Promise<ServerActivity|undefined> {
        try {
            const response = await this.client.get<ServerActivity>("/api/activity");
            return response.data;
        } catch (error) {
            if (!axios.isAxiosError(error) || error.response.status === 404) {
                console.error("Failed to retrieve server activity");
            }
        }
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
    async startBackup(): Promise<void> {
        // TODO: Replace with actual implementation
        // This will need to connect to a backup-specific WebSocket endpoint

        console.log("Mock: Starting backup");
        // For now, throw an error to indicate this is not implemented
        throw new Error("Backup operation not yet implemented");
    }
    async startDeployment(request: DeploymentRequest): Promise<DeploymentResponse> {
        const response = await this.client.post("/api/deployment/start", request);
        return response.data;
    }
    connectActivity(activityId: string): ActivitySocket {
        const url = config.backendUrl + "/activity/" + activityId;
        const socket: SessionSocket = io(url, {
            auth: {
                token: this.token,
            },
        });
        return socket;
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
