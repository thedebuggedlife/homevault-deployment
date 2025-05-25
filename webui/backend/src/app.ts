import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { body } from 'express-validator';
import { login } from '@/handlers/login';
import { handleValidationErrors } from '@/middleware/validation';
import { errorHandler } from '@/middleware/error';
import { authenticateToken } from '@/middleware/auth';
import { status } from '@/handlers/status';
import { check } from '@/handlers/check';
import { logger } from '@/logger';
import { startInstallation } from './handlers/startInstallation';
import installer from './services/installer';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(errorHandler);
app.post('/api/login', [
  body('username').notEmpty(),
  body('password').notEmpty(),
  handleValidationErrors
], login);
app.get('/api/check', authenticateToken, check);
app.get('/api/status', authenticateToken, status);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected');

  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });

  // Handle installation progress
  socket.on('startInstallation', startInstallation);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});