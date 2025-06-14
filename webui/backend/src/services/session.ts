import { ServerActivity, SessionClientEvents, SessionServerEvents } from "@/types";
import { Dictionary } from "lodash";
import { Namespace, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { logger as rootLog } from "@/logger";
import _ from "lodash";
import { SudoCache } from "@/util/sudoCache";

export type SessionSocket = Socket<SessionClientEvents, SessionServerEvents>;

class Session {
    private readonly logger;
    private sudoCache = new SudoCache();

    constructor(sessionId: string, private socket: SessionSocket) {
        this.logger = rootLog.child({ source: "Session", sessionId })
        this.socket.emit("hello", sessionId);
    }

    async askSudo(username: string, timeoutMs = 90000) {
        this.logger.info("Requesting sudo password", { username, timeoutMs });
        const cached = this.sudoCache.get(username);
        if (!_.isEmpty(cached)) {
            this.logger.info("Using cached sudo password for " + username);
            return cached;
        }
        try {
            const request = {
                username,
                timeoutMs
            }
            const { password } = await this.socket.timeout(timeoutMs).emitWithAck("sudo", request);
            if (!_.isEmpty(password)) {
                this.logger.info("Caching sudo password for " + username);
                this.sudoCache.set(username, password!);
            }
            return password;
        } catch (error) {
            this.logger.warn("Sudo password request timed out", { timeoutMs });
            throw error;
        }
    }

    close() {
        this.sudoCache.clear();
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
            this.connections[sessionId]?.close();
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