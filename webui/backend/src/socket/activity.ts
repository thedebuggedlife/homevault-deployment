import activity, { ActivitySocket } from "@/services/activity";

export const activityNamespace = /\/activity\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

export function activitySocket(socket: ActivitySocket) {
    const activityId = socket.nsp.name.split('/')[2];
    activity.register(activityId, socket);
}