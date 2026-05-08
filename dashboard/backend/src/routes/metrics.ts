import { Router, Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import MetricsCollector from '../services/MetricsCollector';
import { RedisCache } from '../services/RedisCache';
import { logger } from '../utils/logger';

function parseProcMeminfo(): Record<string, number> {
  const raw = fs.readFileSync('/proc/meminfo', 'utf8');
  const result: Record<string, number> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)/);
    if (m) result[m[1]] = parseInt(m[2], 10) * 1024; // kB -> bytes
  }
  return result;
}

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

      const mem = parseProcMeminfo();
      const totalMem = mem['MemTotal'] ?? os.totalmem();
      const availableMem = mem['MemAvailable'] ?? os.freemem();
      const usedMem = totalMem - availableMem;
      const swapTotal = mem['SwapTotal'] ?? 0;
      const swapFree = mem['SwapFree'] ?? 0;
      const swapUsed = swapTotal - swapFree;

      const GB = (b: number) => parseFloat((b / 1024 / 1024 / 1024).toFixed(2));

      res.json({
        ...latest,
        host: {
          totalMemBytes: totalMem,
          usedMemBytes: usedMem,
          availableMemBytes: availableMem,
          totalMemGB: GB(totalMem),
          usedMemGB: GB(usedMem),
          availableMemGB: GB(availableMem),
          memPercent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
          swapTotalGB: GB(swapTotal),
          swapUsedGB: GB(swapUsed),
          swapPercent: swapTotal > 0 ? parseFloat(((swapUsed / swapTotal) * 100).toFixed(1)) : 0,
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
