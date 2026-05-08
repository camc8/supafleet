import { Router, Request, Response } from 'express';
import { CreateInstanceRequest } from '../types';
import InstanceManager from '../services/InstanceManager';
import DockerManager from '../services/DockerManager';
import { logger } from '../utils/logger';

export function createInstanceRoutes(
  instanceManager: InstanceManager,
  dockerManager: DockerManager
): Router {
  const router = Router();

  /**
   * GET /api/instances
   * List all instances
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const instances = await instanceManager.listInstances();
      res.json(instances);
    } catch (error) {
      logger.error('Error listing instances:', error);
      res.status(500).json({ error: 'Failed to list instances' });
    }
  });

  /**
   * GET /api/instances/:name
   * Get specific instance details
   */
  router.get('/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const instance = await instanceManager.getInstance(name);

      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json(instance);
    } catch (error) {
      logger.error(`Error getting instance ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get instance' });
    }
  });

  /**
   * POST /api/instances
   * Create a new instance
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const createRequest: CreateInstanceRequest = req.body;

      // Validate required fields
      if (!createRequest.name) {
        return res.status(400).json({ error: 'Instance name is required' });
      }

      if (!createRequest.deploymentType) {
        return res.status(400).json({ error: 'Deployment type is required' });
      }

      const instance = await instanceManager.createInstance(createRequest);
      res.status(201).json(instance);
    } catch (error: any) {
      logger.error('Error creating instance:', error);
      res.status(500).json({ error: error.message || 'Failed to create instance' });
    }
  });

  /**
   * DELETE /api/instances/:name
   * Delete an instance
   */
  router.delete('/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { removeVolumes } = req.query;

      await instanceManager.deleteInstance(name, removeVolumes === 'true');
      res.json({ message: `Instance ${name} deleted successfully` });
    } catch (error: any) {
      logger.error(`Error deleting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to delete instance' });
    }
  });

  /**
   * POST /api/instances/:name/start
   * Start an instance
   */
  router.post('/:name/start', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      await instanceManager.startInstance(name);
      res.json({ message: `Instance ${name} started successfully` });
    } catch (error: any) {
      logger.error(`Error starting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to start instance' });
    }
  });

  /**
   * POST /api/instances/:name/stop
   * Stop an instance
   */
  router.post('/:name/stop', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { keepVolumes } = req.query;

      await instanceManager.stopInstance(name, keepVolumes !== 'false');
      res.json({ message: `Instance ${name} stopped successfully` });
    } catch (error: any) {
      logger.error(`Error stopping instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to stop instance' });
    }
  });

  /**
   * POST /api/instances/:name/restart
   * Restart an instance
   */
  router.post('/:name/restart', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      await instanceManager.restartInstance(name);
      res.json({ message: `Instance ${name} restarted successfully` });
    } catch (error: any) {
      logger.error(`Error restarting instance ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to restart instance' });
    }
  });

  /**
   * POST /api/instances/:name/services/:service/restart
   * Restart a specific service
   */
  router.post('/:name/services/:service/restart', async (req: Request, res: Response) => {
    try {
      const { name, service } = req.params;
      await dockerManager.restartService(name, service);
      res.json({ message: `Service ${service} in ${name} restarted successfully` });
    } catch (error: any) {
      logger.error(`Error restarting service ${req.params.service} in ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to restart service' });
    }
  });

  /**
   * PUT /api/instances/:name/credentials
   * Update instance credentials
   */
  router.put('/:name/credentials', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { regenerateKeys } = req.body;

      const credentials = await instanceManager.updateCredentials(name, regenerateKeys);
      res.json(credentials);
    } catch (error: any) {
      logger.error(`Error updating credentials for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to update credentials' });
    }
  });


  /**
   * POST /api/instances/:name/services/:service/stop
   * Stop a specific service
   */
  router.post('/:name/services/:service/stop', async (req, res) => {
    try {
      const { name, service } = req.params;
      const containerName = `${name}-${service}`;
      const { execSync } = require('child_process');
      execSync(`docker stop ${containerName}`, { timeout: 30000 });
      res.json({ message: `Service ${service} stopped successfully` });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to stop service' });
    }
  });

  /**
   * POST /api/instances/:name/services/:service/start
   * Start a specific service
   */
  router.post('/:name/services/:service/start', async (req, res) => {
    try {
      const { name, service } = req.params;
      const containerName = `${name}-${service}`;
      const { execSync } = require('child_process');
      execSync(`docker start ${containerName}`, { timeout: 30000 });
      res.json({ message: `Service ${service} started successfully` });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to start service' });
    }
  });


  /**
   * POST /api/instances/:name/services/:service/disable
   * Permanently disable a service (stop + no restart)
   */
  router.post('/:name/services/:service/disable', async (req, res) => {
    try {
      const { name, service } = req.params;
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const projectsPath = process.env.PROJECTS_PATH || '/root/multibase/projects';
      const projectPath = path.join(projectsPath, name);
      const containerName = name + '-' + service;

      try { execSync('docker stop ' + containerName, { timeout: 30000 }); } catch(e) {}
      execSync('docker update --restart=no ' + containerName, { timeout: 10000 });

      // Persist via docker-compose.override.yml so it survives compose operations
      const overridePath = path.join(projectPath, 'docker-compose.override.yml');
      let services: Record<string, string> = {};
      if (fs.existsSync(overridePath)) {
        const lines = fs.readFileSync(overridePath, 'utf8').split('\n');
        let cur = '';
        for (const l of lines) {
          const m = l.match(/^  ([\w-]+):/); if (m) cur = m[1];
          if (cur && l.includes('restart:')) services[cur] = 'no';
        }
      }
      services[service] = 'no';
      const yaml = 'services:\n' + Object.keys(services).map(s => `  ${s}:\n    restart: "no"`).join('\n') + '\n';
      fs.writeFileSync(overridePath, yaml);

      // Track disabled services list
      const trackPath = path.join(projectPath, '.disabled-services');
      let disabled: string[] = [];
      try { if (fs.existsSync(trackPath)) disabled = JSON.parse(fs.readFileSync(trackPath, 'utf8')); } catch(e) {}
      if (!disabled.includes(service)) disabled.push(service);
      fs.writeFileSync(trackPath, JSON.stringify(disabled));

      res.json({ message: 'Service ' + service + ' disabled permanently' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to disable service' });
    }
  });

  /**
   * POST /api/instances/:name/services/:service/enable
   * Re-enable a disabled service
   */
  router.post('/:name/services/:service/enable', async (req, res) => {
    try {
      const { name, service } = req.params;
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      const projectsPath = process.env.PROJECTS_PATH || '/root/multibase/projects';
      const projectPath = path.join(projectsPath, name);
      const containerName = name + '-' + service;

      execSync('docker update --restart=unless-stopped ' + containerName, { timeout: 10000 });
      execSync('docker start ' + containerName, { timeout: 30000 });

      // Remove from override file
      const overridePath = path.join(projectPath, 'docker-compose.override.yml');
      if (fs.existsSync(overridePath)) {
        const lines = fs.readFileSync(overridePath, 'utf8').split('\n');
        let cur = '';
        const services: Record<string, string> = {};
        for (const l of lines) {
          const m = l.match(/^  ([\w-]+):/); if (m) cur = m[1];
          if (cur && l.includes('restart:') && cur !== service) services[cur] = 'no';
        }
        if (Object.keys(services).length === 0) {
          fs.unlinkSync(overridePath);
        } else {
          const yaml = 'services:\n' + Object.keys(services).map(s => `  ${s}:\n    restart: "no"`).join('\n') + '\n';
          fs.writeFileSync(overridePath, yaml);
        }
      }

      // Remove from tracking file
      const trackPath = path.join(projectPath, '.disabled-services');
      if (fs.existsSync(trackPath)) {
        try {
          let disabled: string[] = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
          disabled = disabled.filter((s: string) => s !== service);
          if (disabled.length === 0) { fs.unlinkSync(trackPath); }
          else { fs.writeFileSync(trackPath, JSON.stringify(disabled)); }
        } catch(e) {}
      }

      res.json({ message: 'Service ' + service + ' enabled' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to enable service' });
    }
  });


  /**
   * POST /api/instances/:name/setup-nginx
   * Generate nginx config for an instance and reload nginx
   */
  router.post('/:name/setup-nginx', async (req, res) => {
    try {
      const { name } = req.params;
      const { execSync } = require('child_process');
      const fs2 = require('fs');
      const path2 = require('path');

      // Get instance to find its Kong port
      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const kongPort = instance.ports.kong_http || 8000;
      const studioPort = instance.ports.studio || 3000;

      const nginxConf = `
    # ${name} Supabase API
    location ~ ^/${name}/(rest|auth|storage|realtime|functions|ingest)/ {
        rewrite ^/${name}/(.*)  /$1 break;
        proxy_pass http://localhost:${kongPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ${name} Studio
    location /${name}/studio {
        auth_request /auth/verify;
        error_page 401 = @login_redirect;
        rewrite ^/${name}/studio(/.*)? $1 break;
        proxy_pass http://localhost:${studioPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect ~^/(.*) /${name}/studio/$1;
    }

    # ${name} root redirect
    location = /${name} {
        return 301 https://$host/${name}/studio;
    }
`;

      const confPath = `/etc/nginx/multibase-instances/${name}.conf`;
      fs2.writeFileSync(confPath, nginxConf);
      execSync('nginx -t && systemctl reload nginx', { timeout: 15000 });
      res.json({ message: 'Nginx configured for ' + name, confPath });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to setup nginx' });
    }
  });

  /**
   * GET /api/instances/:name/services
   * Get services status for an instance
   */
  router.get('/:name/services', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const services = await dockerManager.getServiceStatus(name);
      res.json(services);
    } catch (error) {
      logger.error(`Error getting services for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  });

  return router;
}
