import { DeploymentServerEvents, DeploymentClientEvents } from "@backend/types";
import { EmitterMixin, createNanoEvents } from "nanoevents";
import { Socket } from "socket.io-client";


export type DeploymentSocket = Socket<DeploymentServerEvents, DeploymentClientEvents>;

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