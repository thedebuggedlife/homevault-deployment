import config from "@/config";
import { CheckResponse, DeploymentClientEvents, DeploymentConfig, DeploymentRequest, DeploymentServerEvents, GetModulesResponse, LoginResponse, SystemStatusResponse } from "@backend/types";
import axios, { AxiosRequestConfig } from "axios";
import { createNanoEvents, EmitterMixin } from "nanoevents";
import { io, Socket } from "socket.io-client";

export interface DeploymentOperationEvents {
    output: (data: string) => void;
    completed: () => void;
    error: (message: string) => void;
}

export class DeploymentOperation implements EmitterMixin<DeploymentOperationEvents> {
    private emitter = createNanoEvents<DeploymentOperationEvents>();
    private completed = false;

    constructor(private socket: Socket<DeploymentServerEvents>) {
        socket.on("disconnect", () => {
            if (!this.completed) {
                this.completed = true;
                this.emitter.emit("error", "Disconnected from backend");
                delete this.socket;
            }
        });
        socket.on("completed", () => {
            this.completed = true;
            this.emitter.emit("completed");
            this.close();
        });
        socket.on("error", (error) => {
            this.completed = true;
            this.emitter.emit("error", error);
            this.close();
        })
        socket.on("output", (data) => {
            this.emitter.emit("output", data);
        })
    }

    close() {
        this.socket?.disconnect();
    }

    on<E extends keyof DeploymentOperationEvents>(
        event: E, 
        callback: (DeploymentOperationEvents)[E]) 
    {
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
        const response = await this.client.post<LoginResponse>('/api/login', {
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
                Authorization: `Bearer ${token}`
            }
        }
        const response = await this.client.get<CheckResponse>('/api/check', reqConfig);
        this.setToken(token);
        return response.data;
    }
    async logout() {
        this.setToken();
    }
    async getStatus(): Promise<SystemStatusResponse> {
        const response = await this.client.get<SystemStatusResponse>('/api/status');
        return response.data;
    }
    async getModules(): Promise<GetModulesResponse> {
        const response = await this.client.get<GetModulesResponse>('/api/modules');
        return response.data;
    }
    async getDeploymentConfig(request: DeploymentRequest): Promise<DeploymentConfig> {
        const response = await this.client.post<DeploymentConfig>('/api/deployment/config', request);
        return response.data;
    }
    async startDeployment(request: DeploymentRequest): Promise<DeploymentOperation> {
        try {
            const url = config.backendUrl + '/deployment';
            const socket: Socket<DeploymentServerEvents, DeploymentClientEvents> = io(url, {
                path: '/socket.io',
                auth: {
                    token: this.token,
                },
            });
            return new Promise<DeploymentOperation>((resolve, reject) => {
                const operation = new DeploymentOperation(socket);
                let firstConnect = true;
                socket.on("connect", () => {
                    if (firstConnect) {
                        socket.emit("start", request);
                        firstConnect = false;
                    }
                    resolve(operation);
                });
                socket.on("connect_error", (error) => {
                    reject(error);
                })
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