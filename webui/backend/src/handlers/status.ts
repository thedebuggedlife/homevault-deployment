import { AuthenticatedRequest } from "@/middleware/auth";
import { Response } from 'express';
import installerService from '@/services/installer';
import { logger } from "@/logger";

export async function status(_req: AuthenticatedRequest, res: Response) {
    try {
      const status = await installerService.getSystemStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get system status:', error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  }