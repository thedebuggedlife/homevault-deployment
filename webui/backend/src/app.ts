import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import { body } from "express-validator";
import { login } from "@/api/login";
import { handleValidationErrors } from "@/middleware/validation";
import { errorHandler } from "@/middleware/error";
import { authenticateToken, socketAuth } from "@/middleware/auth";
import { getStatus } from "@/api/status";
import { refreshToken } from "@/api/token";
import { getModules } from "./api/modules";
import { getDeploymentConfig } from "./api/deployment";
import { logger } from "@/logger";
import { getActivity, postActivitySudo } from "./api/activity";
import { deploymentSocket } from "./socket/deployment";
import getBackupStatus from "./api/backup/getBackupStatus";
import getSnapshots from "./api/backup/getSnapshots";
import initRepository from "./api/backup/initRepository";
import updateSchedule from "./api/backup/updateSchedule";
import { sessionSocket } from "./socket/session";
import { requestContext } from "./middleware/context";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: "*", // process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});

io.of("/deployment").use(socketAuth).on("connection", deploymentSocket);
io.of("/session").use(socketAuth).on("connection", sessionSocket);

app.use(cors());
app.use(express.json());
app.use(requestContext());

app.get("/api/activity", authenticateToken, getActivity);
app.post("/api/activity/sudo", postActivitySudo);
app.post("/api/backup/init", authenticateToken, initRepository);
app.post("/api/backup/schedule", authenticateToken, updateSchedule);
app.get("/api/backup/snapshots", authenticateToken, getSnapshots);
app.get("/api/backup/status", authenticateToken, getBackupStatus);
app.post("/api/deployment/config", authenticateToken, getDeploymentConfig);
app.post("/api/login", [body("username").notEmpty(), body("password").notEmpty(), handleValidationErrors], login);
app.get("/api/modules", authenticateToken, getModules);
app.get("/api/status", authenticateToken, getStatus);
app.post("/api/token/refresh", authenticateToken, refreshToken);

// Error handler MUST be last
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
