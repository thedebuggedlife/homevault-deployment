import config from "@/config";
import { CheckResponse, DeploymentConfig, DeploymentRequest, GetModulesResponse, LoginResponse, SystemStatusResponse } from "@backend/types";
import axios, { AxiosRequestConfig } from "axios";

class BackendServer {
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
    private setToken(token?: string) {
        if (token) {
            this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } else {
            delete this.client.defaults.headers.common["Authorization"];
        }
    }
}

export default new BackendServer();