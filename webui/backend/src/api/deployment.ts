import { AuthenticatedRequest } from "@/middleware/auth";
import installer, { DeploymentInstance } from "@/services/installer";
import { DeploymentConfig, DeploymentRequest, ErrorResponse } from "@/types";
import { Response } from "express";
import { Socket } from 'socket.io';
import { logger } from '@/logger';
import { DeploymentClientEvents, DeploymentServerEvents } from '@/types';
import { getErrorMessage } from '@/errors';
import { Unsubscribe } from "nanoevents";

export async function getDeploymentConfig(req: AuthenticatedRequest<DeploymentRequest>, res: Response<DeploymentConfig|ErrorResponse>) {
    const config = await installer.getDeploymentConfig(req.body);
    res.json(config);
}

export function deploymentSocket(socket: Socket<DeploymentClientEvents, DeploymentServerEvents>) {
    logger.info('New deployment socket connection');
    let attached = false;
    const callbacks: Unsubscribe[] = [];
    const checkAttached = (): boolean => {
        if (attached) {
            logger.warn("Cannot attach socket, it is already attached to another deployment");
            socket.emit("error", "Already attached to a deployment");
            socket.disconnect();
            return true;
        }
        return false;
    }
    const attach = (instance: DeploymentInstance) => {
        callbacks.push(
            instance.events.on("output", (data: string, offset: number) => {
                socket.emit("output", data, offset);
            }),
            instance.events.on("completed", (error) => {
                if (error) {
                    logger.error("Deployment error: " + getErrorMessage(error));
                    socket.emit("error", "Deployment error: " + getErrorMessage(error));
                } else {
                    logger.info("Deployment completed successfully");
                    socket.emit("completed");
                }
                socket.disconnect();
            })
        );
    }
    const detach = () => {
        callbacks.forEach(cb => cb());
    }

    socket.on('start', async (request: DeploymentRequest) => {
        if (!checkAttached()) {
            logger.info("Starting new deployment");
            try {
                const instance = installer.startDeployment(request);
                attach(instance);
                socket.emit("started", instance.id);
                attached = true;
            } catch (error) {
                socket.emit("error", "Failed to start deployment: " + getErrorMessage(error));
                socket.disconnect();
            }
        }
    });

    socket.on('attach', async (id: string) => {
        if (!checkAttached()) {
            logger.info("Attaching to existing deployment");
            const instance = installer.getCurrentDeployment();
            if (!instance) {
                socket.emit("error", "There is no deployment in progress");
                socket.disconnect();
                return;
            }
            if (instance.id != id) {
                socket.emit("error", "The requested deployment ID is not in progress");
                socket.disconnect();
                return;
            }
            attach(instance);
            socket.emit("backfill", instance.output);
        }
    })

    socket.on('disconnect', () => {
        detach();
        logger.info('Deployment socket disconnected');
    });
}