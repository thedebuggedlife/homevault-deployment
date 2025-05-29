import { AuthenticatedRequest } from "@/middleware/auth";
import installer from "@/services/installer";
import { DeploymentConfig, DeploymentRequest, ErrorResponse } from "@/types";
import { Response } from "express";
import { Socket } from 'socket.io';
import { logger } from '@/logger';
import { DeploymentClientEvents, DeploymentServerEvents } from '@/types';
import { getErrorMessage, ServiceError } from '@/errors';

export async function getDeploymentConfig(req: AuthenticatedRequest<DeploymentRequest>, res: Response<DeploymentConfig|ErrorResponse>) {
    const config = await installer.getDeploymentConfig(req.body);
    res.json(config);
}

export function startDeployment(socket: Socket<DeploymentClientEvents, DeploymentServerEvents>) {
    logger.info('New deployment socket connection');

    socket.on('start', (request: DeploymentRequest) => {
        logger.info("Starting new deployment");
        try {
            installer.startDeployment(request).then(
                () => {
                    logger.info("Deployment completed successfully");
                    socket.emit("completed");
                    socket.disconnect();
                },
                error => {
                    if (!(error instanceof ServiceError)) {
                        logger.error("Deployment error: " + getErrorMessage(error));
                    }
                    socket.emit("error", getErrorMessage(error));
                    socket.disconnect();
                }
            );
            const instance = installer.getCurrentDeployment();
            if (!instance) {
                logger.warn("There is no deployment instance to listen for output");
            } else {
                instance.events.on("output", (data: string) => {
                    socket.emit("output", data);
                });
            }
        } catch (error) {
            socket.emit("error", "Failed to start deployment: " + getErrorMessage(error));
            socket.disconnect();
        }
    });

    socket.on('disconnect', () => {
        logger.info('Deployment socket disconnected');
    });
}