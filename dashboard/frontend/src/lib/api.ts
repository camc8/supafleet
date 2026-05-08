const BASE = (import.meta as any).env?.VITE_API_URL || '';

const req = async (path: string, opts: RequestInit = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => null);
};

export const instancesApi = {
  list: () => req('/api/instances'),
  get: (id: string) => req(`/api/instances/${id}`),
  create: (data: any) => req('/api/instances', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string, removeVolumes?: boolean) =>
    req(`/api/instances/${id}?removeVolumes=${removeVolumes || false}`, { method: 'DELETE' }),
  start: (id: string) => req(`/api/instances/${id}/start`, { method: 'POST' }),
  stop: (id: string) => req(`/api/instances/${id}/stop`, { method: 'POST' }),
  restart: (id: string) => req(`/api/instances/${id}/restart`, { method: 'POST' }),
  restartService: (id: string, svc: string) =>
    req(`/api/instances/${id}/services/${svc}/restart`, { method: 'POST' }),
  stopService: (id: string, svc: string) =>
    req(`/api/instances/${id}/services/${svc}/stop`, { method: 'POST' }),
  startService: (id: string, svc: string) =>
    req(`/api/instances/${id}/services/${svc}/start`, { method: 'POST' }),
  disableService: (id: string, svc: string) =>
    req(`/api/instances/${id}/services/${svc}/disable`, { method: 'POST' }),
  enableService: (id: string, svc: string) =>
    req(`/api/instances/${id}/services/${svc}/enable`, { method: 'POST' }),
};

export const healthApi = {
  get: (id: string) => req(`/api/instances/${id}/health`),
  refresh: (id: string) => req(`/api/instances/${id}/health/refresh`, { method: 'POST' }),
};

export const metricsApi = {
  getSystem: () => req('/api/metrics/system'),
  getInstance: (id: string) => req(`/api/metrics/instances/${id}`),
  getHistory: (id: string, since?: string, limit = 100) =>
    req(`/api/metrics/instances/${id}/history?${since ? `since=${since}&` : ''}limit=${limit}`),
};

export const logsApi = {
  getInstance: (id: string, tail = 100) => req(`/api/logs/instances/${id}?tail=${tail}`),
  getService: (id: string, svc: string, tail = 100) =>
    req(`/api/logs/instances/${id}/services/${svc}?tail=${tail}`),
};

export const alertsApi = {
  list: () => req('/api/alerts'),
  getStats: () => req('/api/alerts/stats'),
  acknowledge: (id: string) => req(`/api/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id: string) => req(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  getRules: () => req('/api/alert-rules'),
  createRule: (data: any) => req('/api/alert-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: any) =>
    req(`/api/alert-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRule: (id: string) => req(`/api/alert-rules/${id}`, { method: 'DELETE' }),
};
