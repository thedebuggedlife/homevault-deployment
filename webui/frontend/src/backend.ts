import config from "@/config";
import {
    CheckResponse,
    CurrentActivity,
    DeploymentClientEvents,
    DeploymentConfig,
    DeploymentRequest,
    DeploymentServerEvents,
    GetModulesResponse,
    LoginResponse,
    SystemStatusResponse,
} from "@backend/types";
import axios, { AxiosRequestConfig } from "axios";
import { createNanoEvents, EmitterMixin } from "nanoevents";
import { io, Socket } from "socket.io-client";

type DeploymentSocket = Socket<DeploymentServerEvents, DeploymentClientEvents>;

export interface DeploymentOperationEvents {
    backfill: (data: string[]) => void;
    output: (data: string, offset: number) => void;
    completed: () => void;
    error: (message: string) => void;
}

export class DeploymentOperation implements EmitterMixin<DeploymentOperationEvents> {
    private readonly emitter = createNanoEvents<DeploymentOperationEvents>();
    private completed = false;

    constructor(private socket: DeploymentSocket, public id?: string) {
        socket.on("disconnect", () => {
            console.log("Received `disconnect` event");
            if (!this.completed) {
                this.completed = true;
                this.emitter.emit("error", "Disconnected from backend");
            }
            this.close();
        });
        socket.on("started", id => this.id = id);
        socket.on("completed", () => {
            console.log("Received `completed` event from server");
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
            console.log("Received `output` event from server", data);
            this.emitter.emit("output", data, offset);
        });
        socket.on("backfill", (data) => {
            console.log("Received `backfill` event from server", data);
            this.emitter.emit("backfill", data);
        });
    }

    get isInstalling(): boolean {
        return !this.completed;
    }

    close() {
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

class BackendServer {
    private token: string;
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
    async check(token?: string): Promise<CheckResponse> {
        const reqConfig: AxiosRequestConfig = {};
        if (token) {
            reqConfig.headers = {
                Authorization: `Bearer ${token}`,
            };
        }
        const response = await this.client.get<CheckResponse>("/api/check", reqConfig);
        this.setToken(token);
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
    async startDeployment(request: DeploymentRequest): Promise<DeploymentOperation> {
        const socket = await this.connectDeployment();
        const operation = new DeploymentOperation(socket);
        socket.emit("start", request);
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
