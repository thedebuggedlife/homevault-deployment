import SessionManager, { SessionSocket } from "@/services/session";

export function sessionSocket(socket: SessionSocket) {
    SessionManager.register(socket);
}