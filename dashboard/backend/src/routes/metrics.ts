import { Router, Request, Response } from 'express';
import os from 'os';
import MetricsCollector from '../services/MetricsCollector';
import { RedisCache } from '../services/RedisCache';
import { logger } from '../utils/logger';

export function createMetricsRoutes(
  metricsCollector: MetricsCollector,
  redisCache: RedisCache
): Router {
  const router = Router();

  router.get('/system', async (req: Request, res: Response) => {
    try {
      const { since, limit } = req.query;
      const sinceDate = since ? new Date(since as string) : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      const metrics = await metricsCollector.getSystemMetricsHistory(sinceDate, limitNum);
      const latest = metrics.length > 0 ? metrics[metrics.length - 1] : {
        totalCpu: 0, totalMemory: 0, totalDisk: 0,
        instanceCount: 0, runningCount: 0, timestamp: new Date()
      };

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      res.json({
        ...latest,
        host: {
          totalMemBytes: totalMem,
          usedMemBytes: usedMem,
          freeMemBytes: freeMem,
          totalMemGB: parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2)),
          usedMemGB: parseFloat((usedMem / 1024 / 1024 / 1024).toFixed(2)),
          memPercent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
          cpuCount: os.cpus().length
        }
      });
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      res.status(500).json({ error: 'Failed to get system metrics' });
    }
  });

  router.get('/instances/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const metricsMap = await redisCache.getAllMetrics(name);
      const metrics: any = {};
      metricsMap.forEach((value, key) => { metrics[key] = value; });
      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics for instance ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get instance metrics' });
    }
  });

  router.get('/instances/:name/history', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { service, since, limit } = req.query;
      const sinceDate = since ? new Date(since as string) : new Date(Date.now() - 3600000);
      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      const metrics = await metricsCollector.getHistoricalMetrics(
        name, service as string | undefined, sinceDate, limitNum
      );
      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting historical metrics for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get historical metrics' });
    }
  });

  router.get('/instances/:name/services/:service', async (req: Request, res: Response) => {
    try {
      const { name, service } = req.params;
      const metrics = await redisCache.getMetrics(name, service);
      if (!metrics) return res.status(404).json({ error: 'Metrics not found' });
      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics for ${req.params.name}:${req.params.service}:`, error);
      res.status(500).json({ error: 'Failed to get service metrics' });
    }
  });

  return router;
}
