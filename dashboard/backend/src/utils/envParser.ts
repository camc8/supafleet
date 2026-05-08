import fs from 'fs';
import path from 'path';
import { EnvConfig, InstanceCredentials, PortMapping } from '../types';
import { logger } from './logger';

export function parseEnvFile(filePath: string): EnvConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config: EnvConfig = {};
    content.split('\n').forEach(line => {
      if (line.trim().startsWith('#') || line.trim() === '') return;
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        value = value.replace(/^"|"$/g, '').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        config[key] = value;
      }
    });
    return config;
  } catch (error) {
    logger.error(`Error parsing env file ${filePath}:`, error);
    throw error;
  }
}

export function extractCredentials(envConfig: EnvConfig): InstanceCredentials {
  const projectUrl = envConfig.API_EXTERNAL_URL || envConfig.PUBLIC_REST_URL || '';
  // Prefer explicit STUDIO_URL from env; fall back to derived path-based URL
  const studioUrl = envConfig.STUDIO_URL || (projectUrl.replace(/\/+$/, '') + '/studio');
  return {
    project_url: projectUrl,
    studio_url: studioUrl,
    anon_key: envConfig.ANON_KEY || '',
    service_role_key: envConfig.SERVICE_ROLE_KEY || '',
    postgres_password: envConfig.POSTGRES_PASSWORD || '',
    jwt_secret: envConfig.JWT_SECRET || '',
    dashboard_username: envConfig.DASHBOARD_USERNAME || '',
    dashboard_password: envConfig.DASHBOARD_PASSWORD || ''
  };
}

export function extractPorts(envConfig: EnvConfig): PortMapping {
  const p = (v: string | undefined, fallback: number): number => {
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  };
  return {
    kong_http: p(envConfig.KONG_HTTP_PORT, 8000),
    kong_https: p(envConfig.KONG_HTTPS_PORT, 8443),
    studio: p(envConfig.STUDIO_PORT, 3000),
    postgres: p(envConfig.POSTGRES_PORT, 5432),
    pooler: p(envConfig.POOLER_PORT || envConfig.POOLER_PROXY_PORT_TRANSACTION, 6543),
    analytics: p(envConfig.ANALYTICS_PORT, 4000)
  };
}

export function writeEnvFile(filePath: string, config: EnvConfig): void {
  try {
    const lines = Object.entries(config).map(([key, value]) => {
      const quoted = value.includes(' ') || value.includes('#') ? `"${value}"` : value;
      return `${key}=${quoted}`;
    });
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    logger.info(`Wrote env file: ${filePath}`);
  } catch (error) {
    logger.error(`Error writing env file ${filePath}:`, error);
    throw error;
  }
}

export function backupEnvFile(filePath: string): string {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak.${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    logger.info(`Created backup: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error(`Error creating backup of ${filePath}:`, error);
    throw error;
  }
}
