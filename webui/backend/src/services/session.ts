import { ServerActivity, SessionClientEvents, SessionServerEvents } from "@/types";
import { Dictionary } from "lodash";
import { Namespace, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { logger as rootLog } from "@/logger";
import _ from "lodash";

export type SessionSocket = Socket<SessionClientEvents, SessionServerEvents>;

class Session {
    private readonly logger;

    constructor(sessionId: string, private socket: SessionSocket) {
        this.logger = rootLog.child({ source: "Session", sessionId })
        this.socket.emit("hello", sessionId);
    }

    async askSudo(username: string, timeoutMs = 90000) {
        this.logger.info("Requesting sudo password", { username, timeoutMs });
        try {
            const request = {
                username,
                timeoutMs
            }
            const { password } = await this.socket.timeout(timeoutMs).emitWithAck("sudo", request);
            return password;    
        } catch (error) {
            this.logger.warn("Sudo password request timed out", { timeoutMs });
            throw error;
        }
    }
}

class SessionManager {
    private readonly logger = rootLog.child({ source: "SessionManager" });
    private readonly connections: Dictionary<Session> = {};
    private namespace?: Namespace<SessionClientEvents, SessionServerEvents>;

    register(socket: SessionSocket) {
        this.namespace = socket.nsp;
        const sessionId = uuid();
        this.logger.info("Session connected", { sessionId });
        socket.on("disconnect", (reason) => {
            this.logger.info("Session disconnected", { sessionId, reason });
            delete this.connections[sessionId];
        });
        this.connections[sessionId] = new Session(sessionId, socket);
    }

    get(sessionId: string): Session|undefined {
        return this.connections[sessionId];
    }

    onActivity(activity?: ServerActivity) {
        this.namespace?.emit("activity", activity);
    }
}

export default new SessionManager();