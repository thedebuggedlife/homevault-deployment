import backend, { ActivitySocket } from "@/backend/backend";
import { useCallback, useEffect, useRef, useState } from "react";

export function useServerActivity(activityId: string) {
    const [output, setOutput] = useState<string[]>([]);
    const [completed, setCompleted] = useState<boolean>(false);
    const [error, setError] = useState<string>();
    const socket = useRef<ActivitySocket>();
    
    useEffect(() => {
        setCompleted(false);
        setError(null);
        socket.current?.disconnect();
        if (activityId) {
            console.log("Attaching to activity " + activityId);
            socket.current = backend.connectActivity(activityId);
            socket.current.on("output", output => {
                console.log("Received output from activity " + activityId);
                setOutput(prev => [...prev, ...output])
            });
            socket.current.on("end", error => {
                console.log(`Activity ${activityId} completed with ${error}`);
                setCompleted(true);
                setError(error);
            });
        }
        return () => {
            socket.current?.disconnect();
        }
    }, [activityId]);

    const abort = useCallback(() => {
        console.warn("Aborting current activity");
        socket.current?.emit("abort");
    },[]);

    return {
        output,
        completed,
        error,
        abort
    }
}