import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CreateInstanceRequest, SupabaseInstance, InstanceCredentials, PortMapping } from '../types';
import { generateAllKeys } from '../utils/keyGenerator';
import { calculatePorts, getRandomBasePort } from '../utils/portManager';
import { parseEnvFile, extractCredentials, extractPorts, writeEnvFile, backupEnvFile } from '../utils/envParser';
import { logger } from '../utils/logger';
import DockerManager from './DockerManager';

const execAsync = promisify(exec);

export class InstanceManager {
  private projectsPath: string;
  private templatesPath: string;
  private dockerManager: DockerManager;

  constructor(projectsPath: string, dockerManager: DockerManager) {
    this.projectsPath = path.resolve(projectsPath);
    this.templatesPath = path.resolve(path.join(projectsPath, '..'));
    this.dockerManager = dockerManager;

    if (!fs.existsSync(this.projectsPath)) {
      fs.mkdirSync(this.projectsPath, { recursive: true });
      logger.info(`Created projects directory: ${this.projectsPath}`);
    }
  }

  async listInstances(): Promise<SupabaseInstance[]> {
    try {
      if (!fs.existsSync(this.projectsPath)) return [];

      const projectDirs = fs.readdirSync(this.projectsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const instancePromises = projectDirs.map(async (projectName) => {
        try {
          return await this.getInstance(projectName);
        } catch (error) {
          logger.warn(`Error loading instance ${projectName}:`, error);
          return null;
        }
      });

      const results = await Promise.all(instancePromises);
      return results.filter((i): i is SupabaseInstance => i !== null);
    } catch (error) {
      logger.error('Error listing instances:', error);
      throw error;
    }
  }

  async getInstance(name: string): Promise<SupabaseInstance | null> {
    try {
      const projectPath = path.join(this.projectsPath, name);
      const envPath = path.join(projectPath, '.env');

      if (!fs.existsSync(projectPath) || !fs.existsSync(envPath)) return null;

      const envConfig = parseEnvFile(envPath);
      const credentials = extractCredentials(envConfig);
      const ports = extractPorts(envConfig);
      const services = await this.dockerManager.getServiceStatus(name);

      const runningServices = services.filter(s => s.status === 'running').length;
      const totalServices = services.length;
      // Only count services with an actual health check (not 'none') configured
      const healthChecked = services.filter(s => s.status === 'running' && (s.health === 'healthy' || s.health === 'unhealthy'));
      const healthyServices = healthChecked.filter(s => s.health === 'healthy').length;
      const unhealthyServices = healthChecked.filter(s => s.health === 'unhealthy').length;

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'stopped' = 'stopped';
      if (runningServices === 0) {
        overallStatus = 'stopped';
      } else if (unhealthyServices === 0) {
        overallStatus = 'healthy'; // All running services healthy or no health check configured
      } else if (healthyServices > 0) {
        overallStatus = 'degraded'; // Mix of healthy and unhealthy
      } else {
        overallStatus = 'unhealthy'; // All health-checked services are unhealthy
      }

      const stats = fs.statSync(projectPath);

      return {
        id: name,
        name,
        status: overallStatus,
        basePort: ports.kong_http,
        ports,
        credentials,
        services,
        health: {
          overall: overallStatus,
          healthyServices,
          totalServices,
          lastChecked: new Date()
        },
        createdAt: stats.birthtime,
        updatedAt: stats.mtime
      };
    } catch (error) {
      logger.error(`Error getting instance ${name}:`, error);
      return null;
    }
  }

  async createInstance(request: CreateInstanceRequest): Promise<SupabaseInstance> {
    const { name, basePort, deploymentType, domain, protocol, corsOrigins } = request;

    logger.info(`Creating new instance: ${name}`);

    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('Instance name must contain only lowercase letters, numbers, and hyphens');
    }

    const existing = await this.getInstance(name);
    if (existing) {
      throw new Error(`Instance ${name} already exists`);
    }

    const projectPath = path.join(this.projectsPath, name);

    try {
      fs.mkdirSync(projectPath, { recursive: true });
      logger.info(`Created project directory: ${projectPath}`);

      const finalBasePort = basePort || getRandomBasePort();
      const ports = await calculatePorts(finalBasePort);
      const keys = generateAllKeys();

      const projectDomain = domain || 'localhost';
      const projectProtocol = protocol || (deploymentType === 'localhost' ? 'http' : 'https');

      
      const apiExternalUrl = deploymentType === 'localhost'
        ? `${projectProtocol}://${projectDomain}:${ports.kong_http}`
        : `${projectProtocol}://${name}.${projectDomain}`;

      const studioUrl = deploymentType === 'localhost'
        ? `http://localhost:${ports.studio}`
        : `https://${name}.${projectDomain}/studio`;

      const envConfig = this.generateEnvConfig(name, ports, keys, apiExternalUrl, studioUrl, corsOrigins || []);
      const envPath = path.join(projectPath, '.env');
      writeEnvFile(envPath, envConfig);

      await this.copyDockerComposeTemplate(projectPath, name);
      this.createVolumesStructure(projectPath, name);
      await this.createKongConfig(projectPath, name, keys, apiExternalUrl, corsOrigins || []);
      await this.copyVectorConfig(projectPath, name);
      this.copyPoolerConfig(projectPath, name);
      await this.createDockerComposeOverride(projectPath);

      // Auto-start the instance
      logger.info(`Starting instance: ${name}`);
      await this.startInstance(name);

      // Setup nginx routing
      try {
        await this.setupNginx(name, ports.kong_http, ports.studio);
      } catch (err) {
        logger.warn(`Nginx setup failed (non-fatal): ${err}`);
      }

      logger.info(`Successfully created and started instance: ${name}`);

      const instance = await this.getInstance(name);
      if (!instance) throw new Error('Failed to retrieve created instance');

      return instance;
    } catch (error) {
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      logger.error(`Error creating instance ${name}:`, error);
      throw error;
    }
  }

  private generateEnvConfig(
    projectName: string,
    ports: PortMapping,
    keys: ReturnType<typeof generateAllKeys>,
    apiExternalUrl: string,
    studioUrl: string,
    corsOrigins: string[]
  ): Record<string, string> {
    const corsOriginsStr = corsOrigins.length > 0 ? corsOrigins.join(',') : apiExternalUrl;

    return {
      // Project
      PROJECT_NAME: projectName,

      // Ports
      KONG_HTTP_PORT: `${ports.kong_http}`,
      KONG_HTTPS_PORT: `${ports.kong_https}`,
      STUDIO_PORT: `${ports.studio}`,
      POSTGRES_PORT: `${ports.postgres}`,
      POOLER_PORT: `${ports.pooler}`,
      ANALYTICS_PORT: `${ports.analytics}`,

      // Database
      POSTGRES_PASSWORD: keys.postgres_password,
      POSTGRES_HOST: 'db',
      POSTGRES_DB: 'postgres',
      POSTGRES_USER: 'postgres',

      // JWT
      JWT_SECRET: keys.jwt_secret,
      JWT_EXPIRY: '3600',
      ANON_KEY: keys.anon_key,
      SERVICE_ROLE_KEY: keys.service_role_key,

      // Dashboard
      DASHBOARD_USERNAME: keys.dashboard_username,
      DASHBOARD_PASSWORD: keys.dashboard_password,

      // URLs (path-based routing)
      API_EXTERNAL_URL: apiExternalUrl,
      SUPABASE_PUBLIC_URL: apiExternalUrl,
      PUBLIC_REST_URL: apiExternalUrl,
      STUDIO_URL: studioUrl,

      // Studio
      STUDIO_DEFAULT_ORGANIZATION: projectName,
      STUDIO_DEFAULT_PROJECT: projectName,

      // Auth
      SITE_URL: apiExternalUrl,
      ADDITIONAL_REDIRECT_URLS: '',
      DISABLE_SIGNUP: 'false',
      ENABLE_EMAIL_SIGNUP: 'true',
      ENABLE_EMAIL_AUTOCONFIRM: 'true',
      ENABLE_ANONYMOUS_USERS: 'false',
      ENABLE_PHONE_SIGNUP: 'true',
      ENABLE_PHONE_AUTOCONFIRM: 'true',

      // Mailer paths
      MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
      MAILER_URLPATHS_INVITE: '/auth/v1/verify',
      MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
      MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',

      // SMTP (configure later)
      SMTP_ADMIN_EMAIL: 'admin@example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_SENDER_NAME: projectName,

      // Storage
      STORAGE_BACKEND: 'file',
      STORAGE_FILE_PATH: '/var/lib/storage',
      GLOBAL_S3_BUCKET: '',
      IMGPROXY_ENABLE_WEBP_DETECTION: 'TRUE',

      // Pooler
      POOLER_POOL_MODE: 'transaction',
      POOLER_PROXY_PORT_TRANSACTION: `${ports.pooler}`,
      POOLER_DEFAULT_POOL_SIZE: '20',
      POOLER_MAX_CLIENT_CONN: '100',
      POOLER_TENANT_ID: `${projectName}-tenant`,

      // PostgREST
      PGRST_DB_SCHEMAS: 'public,storage,graphql_public',

      // Edge functions
      FUNCTIONS_VERIFY_JWT: 'false',

      // Docker socket
      DOCKER_SOCKET_LOCATION: '/var/run/docker.sock',

      // Secrets
      SECRET_KEY_BASE: keys.secret_key_base,
      VAULT_ENC_KEY: keys.vault_enc_key,

      // Analytics
      LOGFLARE_API_KEY: keys.logflare_api_key,

      // CORS
      ADDITIONAL_ALLOWED_ORIGINS: corsOriginsStr,

      // Realtime
      REALTIME_TENANT_ID: 'realtime-dev',
      REALTIME_MAX_CONCURRENT_USERS: '200',

      // Rate limiting
      RATE_LIMIT_ANON: '100',
      RATE_LIMIT_AUTHENTICATED: '200'
    };
  }

  private async copyDockerComposeTemplate(projectPath: string, projectName: string): Promise<void> {
    const templatePath = path.join(this.templatesPath, 'docker-compose.yml');
    const targetPath = path.join(projectPath, 'docker-compose.yml');

    let content = fs.readFileSync(templatePath, 'utf8');

    // Update project name
    content = content.replace(/^name: supabase$/m, `name: ${projectName}`);

    // Update container names (handle realtime special case first)
    content = content.replace(
      /container_name: supabase-realtime/g,
      `container_name: realtime-dev.${projectName}-realtime`
    );
    content = content.replace(/container_name: supabase-/g, `container_name: ${projectName}-`);

    fs.writeFileSync(targetPath, content, 'utf8');
    logger.info(`Created docker-compose.yml for ${projectName}`);
  }

  private createVolumesStructure(projectPath: string, projectName: string): void {
    const volumesPath = path.join(projectPath, 'volumes');
    const dirs = ['db/data', 'storage', 'functions/main', 'logs', 'api', 'pooler', 'analytics', 'studio'];

    dirs.forEach(dir => {
      fs.mkdirSync(path.join(volumesPath, dir), { recursive: true });
    });

    // Copy SQL init scripts from template (these run as postgres init scripts on first start)
    const templateDbPath = path.join(this.templatesPath, 'volumes/db');
    const targetDbPath = path.join(volumesPath, 'db');

    if (fs.existsSync(templateDbPath)) {
      const sqlFiles = fs.readdirSync(templateDbPath).filter(f => f.endsWith('.sql'));
      if (sqlFiles.length === 0) {
        logger.warn('No SQL template files found — DB init scripts will be missing');
      }
      sqlFiles.forEach(file => {
        fs.copyFileSync(path.join(templateDbPath, file), path.join(targetDbPath, file));
      });
      logger.info(`Copied ${sqlFiles.length} SQL init scripts for ${projectName}`);
    } else {
      logger.warn(`Template db path not found: ${templateDbPath}`);
    }

    // Copy edge functions main entry point
    const templateFnMain = path.join(this.templatesPath, 'volumes/functions/main/index.ts');
    if (fs.existsSync(templateFnMain)) {
      fs.copyFileSync(templateFnMain, path.join(volumesPath, 'functions/main/index.ts'));
    }

    // Copy studio-start.sh (resets basePath so studio works at root path)
    const templateStudioScript = path.join(this.templatesPath, 'volumes/studio/studio-start.sh');
    if (fs.existsSync(templateStudioScript)) {
      fs.copyFileSync(templateStudioScript, path.join(volumesPath, 'studio/studio-start.sh'));
      fs.chmodSync(path.join(volumesPath, 'studio/studio-start.sh'), 0o755);
    }

    logger.info(`Created volumes structure for ${projectName}`);
  }

  private async createKongConfig(
    projectPath: string,
    projectName: string,
    keys: ReturnType<typeof generateAllKeys>,
    apiExternalUrl: string,
    corsOrigins: string[]
  ): Promise<void> {
    const templatePath = path.join(this.templatesPath, 'volumes/api/kong.yml');
    const targetPath = path.join(projectPath, 'volumes/api/kong.yml');

    if (!fs.existsSync(templatePath)) {
      logger.warn('Kong template not found, skipping');
      return;
    }

    let kongContent = fs.readFileSync(templatePath, 'utf8');
    kongContent = kongContent.replace(/__PROJECT_NAME__/g, projectName);
    kongContent = kongContent.replace(/__ANON_KEY__/g, keys.anon_key);
    kongContent = kongContent.replace(/__SERVICE_ROLE_KEY__/g, keys.service_role_key);
    kongContent = kongContent.replace(/__CORS_ORIGIN__/g, apiExternalUrl);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, kongContent, 'utf8');
    logger.info('Created Kong configuration');
  }

  private async copyVectorConfig(projectPath: string, projectName: string): Promise<void> {
    const templatePath = path.join(this.templatesPath, 'volumes/logs/vector.yml');
    // Target must be volumes/logs/vector.yml (docker-compose mounts ./volumes/logs/vector.yml)
    const targetPath = path.join(projectPath, 'volumes/logs/vector.yml');

    if (!fs.existsSync(templatePath)) {
      logger.warn('Vector template not found, skipping');
      return;
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace __PROJECT__ placeholder with the actual project name
    content = content.replace(/__PROJECT__/g, projectName);
    // Also replace any remaining supabase- prefixes
    content = content.replace(/supabase-/g, `${projectName}-`);

    fs.writeFileSync(targetPath, content, 'utf8');
    logger.info(`Created Vector configuration for ${projectName}`);
  }

  private copyPoolerConfig(projectPath: string, projectName: string): void {
    const templatePath = path.join(this.templatesPath, 'volumes/pooler/pooler.exs');
    const targetPath = path.join(projectPath, 'volumes/pooler/pooler.exs');

    if (!fs.existsSync(templatePath)) {
      logger.warn('Pooler template not found, skipping');
      return;
    }

    let content = fs.readFileSync(templatePath, 'utf8');

    // Replace the Python-style placeholder with the actual project name
    // pooler.exs uses "{self.project_name}-db" as db_host
    content = content.replace(/\{self\.project_name\}/g, projectName);

    fs.writeFileSync(targetPath, content, 'utf8');
    logger.info(`Created pooler configuration for ${projectName}`);
  }

  private async createDockerComposeOverride(projectPath: string): Promise<void> {
    // Disable analytics and vector by default — they consume ~500MB each and aren't needed for core functionality
    const overrideContent = `services:
  kong:
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro
  studio:
    volumes:
      - ./volumes/studio/studio-start.sh:/studio-start.sh:ro
    entrypoint: /studio-start.sh
  analytics:
    restart: "no"
  vector:
    restart: "no"
`;

    const targetPath = path.join(projectPath, 'docker-compose.override.yml');
    fs.writeFileSync(targetPath, overrideContent, 'utf8');
    logger.info('Created docker-compose.override.yml');
  }

  async setupNginx(name: string, kongPort: number, studioPort: number): Promise<void> {
    const { execSync } = require('child_process');

    const baseDomain = process.env.BASE_DOMAIN || 'db.yourdomain.com';
    const studioPortsDir = '/etc/nginx/multibase-studio-ports';
    if (!fs.existsSync(studioPortsDir)) fs.mkdirSync(studioPortsDir, { recursive: true });
    fs.writeFileSync(`${studioPortsDir}/${name}.conf`, `${name}.${baseDomain} ${studioPort};`);

    const kongPortsDir = '/etc/nginx/multibase-kong-ports';
    if (!fs.existsSync(kongPortsDir)) fs.mkdirSync(kongPortsDir, { recursive: true });
    fs.writeFileSync(`${kongPortsDir}/${name}.conf`, `${name}.${baseDomain} ${kongPort};`);

    execSync('nginx -t && systemctl reload nginx', { timeout: 15000 });
    logger.info(`Nginx configured: https://${name}.${baseDomain} → studio:${studioPort}, kong:${kongPort}`);
  }

  async startInstance(name: string): Promise<void> {
    const projectPath = path.join(this.projectsPath, name);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Instance ${name} does not exist`);
    }

    try {
      logger.info(`Starting instance: ${name}`);
      const { stdout, stderr } = await execAsync('docker compose up -d', { cwd: projectPath });
      if (stderr && !stderr.includes('Creating') && !stderr.includes('Starting') && !stderr.includes('Running') && !stderr.includes('Network') && !stderr.includes('Container')) {
        logger.warn(`Docker compose stderr: ${stderr}`);
      }
      logger.info(`Successfully started instance: ${name}`);
      logger.debug(stdout);
    } catch (error) {
      logger.error(`Error starting instance ${name}:`, error);
      throw error;
    }
  }

  async stopInstance(name: string, keepVolumes: boolean = true): Promise<void> {
    const projectPath = path.join(this.projectsPath, name);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Instance ${name} does not exist`);
    }

    try {
      logger.info(`Stopping instance: ${name}`);
      const command = keepVolumes ? 'docker compose stop' : 'docker compose down -v';
      const { stdout, stderr } = await execAsync(command, { cwd: projectPath });
      if (stderr) logger.warn(`Docker compose stderr: ${stderr}`);
      logger.info(`Successfully stopped instance: ${name}`);
      logger.debug(stdout);
    } catch (error) {
      logger.error(`Error stopping instance ${name}:`, error);
      throw error;
    }
  }

  async restartInstance(name: string): Promise<void> {
    await this.stopInstance(name);
    await this.startInstance(name);
  }

  async deleteInstance(name: string, removeVolumes: boolean = false): Promise<void> {
    const projectPath = path.join(this.projectsPath, name);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Instance ${name} does not exist`);
    }

    try {
      logger.info(`Deleting instance: ${name}`);

      try {
        const command = removeVolumes ? 'docker compose down -v' : 'docker compose down';
        await execAsync(command, { cwd: projectPath });
      } catch (error) {
        logger.warn('Error stopping containers, continuing with deletion:', error);
      }

      fs.rmSync(projectPath, { recursive: true, force: true });
      logger.info(`Successfully deleted instance: ${name}`);
    } catch (error) {
      logger.error(`Error deleting instance ${name}:`, error);
      throw error;
    }
  }

  async updateCredentials(name: string, regenerateKeys: boolean = false): Promise<InstanceCredentials> {
    const projectPath = path.join(this.projectsPath, name);
    const envPath = path.join(projectPath, '.env');

    if (!fs.existsSync(envPath)) {
      throw new Error(`Instance ${name} does not exist`);
    }

    try {
      logger.info(`Updating credentials for instance: ${name}`);
      backupEnvFile(envPath);
      const envConfig = parseEnvFile(envPath);

      if (regenerateKeys) {
        const keys = generateAllKeys();
        envConfig.JWT_SECRET = keys.jwt_secret;
        envConfig.ANON_KEY = keys.anon_key;
        envConfig.SERVICE_ROLE_KEY = keys.service_role_key;
        envConfig.POSTGRES_PASSWORD = keys.postgres_password;
      }

      writeEnvFile(envPath, envConfig);
      logger.info(`Successfully updated credentials for ${name}`);
      return extractCredentials(envConfig);
    } catch (error) {
      logger.error(`Error updating credentials for ${name}:`, error);
      throw error;
    }
  }
}

export default InstanceManager;
