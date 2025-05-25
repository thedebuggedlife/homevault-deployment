import winston from "winston";
import { logger as rootLog } from "@/logger";
import system from "./system";
import { DockerContainer } from "@/types";

const COMPOSE_PROJECT = "homevault";

class DockerService {
    private logger: winston.Logger;

    constructor() {
        this.logger = rootLog.child({ source: 'DockerService' });
    }

    async listContainers(): Promise<DockerContainer[]> {
        try {
            const result = await system.executeCommand<DockerContainer[]>("docker", ["compose", "-p", COMPOSE_PROJECT, "ps", "--format", "json"], {
                jsonOutput: true,
                jsonArray: true,
            });
            return result.data ?? [];
        }
        catch (error) {
            this.logger.error("Failed to list docker containers", { error });
            return [];
        }
    }
}

export default new DockerService();