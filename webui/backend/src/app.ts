import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { body } from 'express-validator';
import { login } from '@/api/login';
import { handleValidationErrors } from '@/middleware/validation';
import { errorHandler } from '@/middleware/error';
import { authenticateToken, socketAuth } from '@/middleware/auth';
import { getStatus } from '@/api/status';
import { refreshToken } from '@/api/token';
import { getModules } from './api/modules';
import { getDeploymentConfig } from './api/deployment';
import { logger } from '@/logger';
import { getActivity } from './api/activity';
import { deploymentSocket } from './socket/deployment';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.of("/deployment").use(socketAuth).on("connection", deploymentSocket);

app.use(cors());
app.use(express.json());

app.post('/api/login', [
  body('username').notEmpty(),
  body('password').notEmpty(),
  handleValidationErrors
], login);
app.post('/api/token/refresh', authenticateToken, refreshToken);
app.get('/api/activity', authenticateToken, getActivity);
app.get('/api/status', authenticateToken, getStatus);
app.get('/api/modules', authenticateToken, getModules);
app.post('/api/deployment/config', authenticateToken, getDeploymentConfig);

// Error handler MUST be last
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});