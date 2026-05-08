import { useState } from 'react';
import type { SupabaseInstance } from '../types';
import { RotateCw, Activity, Square, Play, PowerOff, Power, AlertCircle, X } from 'lucide-react';
import { useRestartService, useStopService, useStartService, useDisableService, useEnableService } from '../hooks/useInstances';
import { logsApi } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';

interface ServicesTabProps { instance: SupabaseInstance; }

const OPTIONAL = ['analytics', 'studio', 'imgproxy', 'vector', 'edge-functions', 'logflare'];
const CORE = ['db', 'kong', 'auth', 'rest', 'pooler', 'realtime'];

function UnhealthyModal({ instanceName, service }: { instanceName: string; service: string }) {
  const [open, setOpen] = useState(false);
  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', instanceName, service, 'modal'],
    queryFn: () => logsApi.getService(instanceName, service, 30),
    enabled: open,
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 hover:opacity-80 transition-opacity cursor-pointer">
          <AlertCircle className="w-3 h-3" />
          unhealthy
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-background border rounded-lg shadow-lg p-6 focus:outline-none">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold">Unhealthy: {service}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Container <span className="font-mono">{instanceName}-{service}</span> is reporting an unhealthy state. Recent logs:
          </p>
          <div className="rounded-md bg-muted p-3 h-64 overflow-y-auto font-mono text-xs">
            {isLoading ? (
              <p className="text-muted-foreground">Loading logs…</p>
            ) : logs ? (
              <pre className="whitespace-pre-wrap break-all text-foreground">{typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2)}</pre>
            ) : (
              <p className="text-muted-foreground">No recent logs available.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const fmt = (sec: number) => {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function ServicesTab({ instance }: ServicesTabProps) {
  const restartM = useRestartService();
  const stopM = useStopService();
  const startM = useStartService();
  const disableM = useDisableService();
  const enableM = useEnableService();

  const isBusy = restartM.isPending || stopM.isPending || startM.isPending || disableM.isPending || enableM.isPending;

  const isStopped = (s: any) => !s.uptime || s.uptime === 0 || s.status === 'stopped' || s.status === 'exited';
  const isCore = (n: string) => CORE.some(c => n.toLowerCase().includes(c));
  const isOptional = (n: string) => OPTIONAL.some(c => n.toLowerCase().includes(c));

  const running = instance.services.filter(s => !isStopped(s)).length;
  const healthy = instance.services.filter(s => s.health === 'healthy').length;

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          <div><p className="text-xs text-muted-foreground mb-1">Total</p><p className="text-2xl font-semibold">{instance.services.length}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Running</p><p className="text-2xl font-semibold">{running}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Healthy</p><p className="text-2xl font-semibold">{healthy}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1">Stopped</p><p className="text-2xl font-semibold text-muted-foreground">{instance.services.length - running}</p></div>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm text-muted-foreground">
        Stop optional services to free RAM. Core services (db, kong, auth, rest, pooler, realtime) must stay running.
        <strong className="text-foreground"> Disable</strong> makes it permanent across restarts.
        <strong className="text-foreground"> Stop</strong> is temporary.
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Service</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-28">Status</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-16 hidden sm:table-cell">Up</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-16 hidden md:table-cell">CPU</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20 hidden md:table-cell">RAM</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {instance.services.map(svc => {
              const stopped = isStopped(svc);
              const core = isCore(svc.name);
              const optional = isOptional(svc.name);
              return (
                <tr key={svc.name} className={`hover:bg-muted/20 transition-colors ${stopped ? 'opacity-55' : ''}`}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className={`w-4 h-4 flex-shrink-0 ${stopped ? 'text-muted-foreground/40' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm">{svc.name}</span>
                          {core && <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-mono border border-border/50">core</span>}
                          {optional && <span className="text-xs px-1.5 py-0.5 bg-muted/50 rounded font-mono text-muted-foreground/70">optional</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{svc.containerName}</p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 w-28">
                    {stopped ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground w-fit">
                        <Square className="w-3 h-3" />
                        stopped
                      </span>
                    ) : svc.health === 'unhealthy' ? (
                      <UnhealthyModal instanceName={instance.name} service={svc.name} />
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground w-fit">
                        <span className={`w-1.5 h-1.5 rounded-full ${svc.health === 'healthy' ? 'bg-foreground' : 'bg-muted-foreground/50'}`} />
                        {svc.health || 'running'}
                      </span>
                    )}
                  </td>

                  {/* Up */}
                  <td className="px-3 py-3 text-right text-xs font-mono hidden sm:table-cell">
                    {stopped ? <span className="text-muted-foreground">—</span> : fmt(svc.uptime)}
                  </td>

                  {/* CPU */}
                  <td className="px-3 py-3 text-right text-xs font-mono hidden md:table-cell">
                    {stopped ? <span className="text-muted-foreground">—</span> : `${svc.cpu.toFixed(1)}%`}
                  </td>

                  {/* RAM */}
                  <td className="px-3 py-3 text-right text-xs font-mono hidden md:table-cell">
                    {stopped ? <span className="text-muted-foreground">—</span> : `${svc.memory.toFixed(0)} MB`}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {stopped ? (
                        <>
                          <button onClick={() => startM.mutateAsync({ name: instance.name, service: svc.name })}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded text-xs font-medium disabled:opacity-50">
                            <Play className="w-3 h-3" />Start
                          </button>
                          {optional && (
                            <button onClick={() => enableM.mutateAsync({ name: instance.name, service: svc.name })}
                              disabled={isBusy}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded text-xs font-medium disabled:opacity-50"
                              title="Enable permanently">
                              <Power className="w-3 h-3" />Enable
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={() => { if(confirm('Restart ' + svc.name + '?')) restartM.mutateAsync({ name: instance.name, service: svc.name }); }}
                            disabled={isBusy}
                            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
                            title="Restart">
                            <RotateCw className={`w-3.5 h-3.5 ${restartM.isPending ? 'animate-spin' : ''}`} />
                          </button>
                          {optional && (
                            <>
                              <button onClick={() => { if(confirm('Stop ' + svc.name + '? (temporary, restarts on reboot)')) stopM.mutateAsync({ name: instance.name, service: svc.name }); }}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded text-xs font-medium disabled:opacity-50">
                                <Square className="w-3 h-3" />Stop
                              </button>
                              <button onClick={() => { if(confirm('Disable ' + svc.name + ' permanently?')) disableM.mutateAsync({ name: instance.name, service: svc.name }); }}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-muted border border-border/50 rounded text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                                <PowerOff className="w-3 h-3" />Disable
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
