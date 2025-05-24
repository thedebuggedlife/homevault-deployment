import { logger } from "@/logger";

interface InstallationData {
    module: string;
    options?: Record<string, any>;
}

export function startInstallation(data: InstallationData) {
    logger.info("Installation started", data);
}
