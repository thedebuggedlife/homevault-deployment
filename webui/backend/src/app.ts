import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { body } from 'express-validator';
import { login } from '@/api/login';
import { handleValidationErrors } from '@/middleware/validation';
import { errorHandler } from '@/middleware/error';
import { authenticateToken } from '@/middleware/auth';
import { getStatus } from '@/api/status';
import { check } from '@/api/check';
import { getModules } from './api/modules';
import { getDeploymentConfig, startDeployment } from './api/deployment';
import { socketAuth } from './middleware/socketAuth';
import { logger } from '@/logger';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.of("/deployment").use(socketAuth).on("connection", startDeployment);

app.use(cors());
app.use(express.json());
app.use(errorHandler);
app.post('/api/login', [
  body('username').notEmpty(),
  body('password').notEmpty(),
  handleValidationErrors
], login);
app.get('/api/check', authenticateToken, check);
app.get('/api/status', authenticateToken, getStatus);
app.get('/api/modules', authenticateToken, getModules);
app.post('/api/deployment/config', authenticateToken, getDeploymentConfig);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});