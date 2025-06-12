import { ActivityClientEvents, ActivityServerEvents, ServerActivity, ServerActivityWithoutId } from "@/types";
import { logger as rootLog } from "@/logger";
import { Namespace, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { getErrorMessage, ServiceError } from "@/errors";
import session from "./session";

export type ActivitySocket = Socket<ActivityClientEvents, ActivityServerEvents>;

class ActivityInstance {
    private namespace?: Namespace<ActivityServerEvents>;
    output: string[] = [];

    constructor(private readonly internal: ServerActivity, private readonly onAbort?: () => void) {
    }

    get id(): string {
        return this.internal.id;
    }

    get activity() {
        return this.internal;
    }

    onOutput(output: string[]) {
        this.output.push(...output);
        this.namespace?.emit("output", output);
    }

    onEnd(error?: any) {
        this.namespace?.emit("end", error ? getErrorMessage(error) : undefined);
        this.namespace?.disconnectSockets();
    }

    register(socket: ActivitySocket) {
        this.namespace = socket.nsp;
        socket.emit("output", this.output);
        socket.on("abort", () => this.onAbort?.());
    }
}

class ActivityManager {
    private readonly logger = rootLog.child({ source: "ActivityManager" });
    private current?: ActivityInstance;

    getCurrent(): ServerActivity | undefined {
        return this.current?.activity;
    }

    getOutput(activityId: string): string[] {
        if (this.current?.id !== activityId) {
            this.logger.warn("The specified activityId for output is not running", { activityId });
            return [];
        } else {
            return this.current.output;
        }
    }

    onStart(starting: ServerActivityWithoutId, onCancel?: () => void): string {
        if (this.current) {
            throw new ServiceError(
                "A new activity cannot start while another is running",
                { starting, current: this.current.activity },
                409
            );
        }
        const activity = { ...starting, id: uuid() } as ServerActivity;
        const instance = new ActivityInstance(activity, onCancel);
        this.current = instance;
        session.onActivity(activity);
        return instance.id;
    }

    onEnd(activityId: string, error?: any) {
        if (this.current?.id !== activityId) {
            throw new ServiceError("The specified activity id is not running", {
                current: this.current?.activity,
                activityId,
            });
        }
        this.current.onEnd(error);
        delete this.current;
        session.onActivity();
    }

    onOutput(activityId: string, output: string[]) {
        if (this.current?.id !== activityId) {
            this.logger.warn("The specified activityId for output is not running", { activityId });
        } else {
            this.current.onOutput(output);
        }
    }

    register(activityId: string, socket: ActivitySocket) {
        if (this.current?.id == activityId) {
            this.current.register(socket);
        } else {
            socket.emit("end");
            socket.disconnect();
        }
    }
}

export default new ActivityManager();
