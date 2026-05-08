import { useState } from 'react';
import type { SupabaseInstance } from '../types';
import { Activity, HardDrive, Network, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useInstanceMetricsHistory, useInstanceMetrics, useSystemMetrics } from '../hooks/useInstances';
import { format } from 'date-fns';

interface MetricsTabProps { instance: SupabaseInstance; }
type TimeRange = '1h' | '6h' | '24h' | '7d';

function ProgressBar({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{sub}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-foreground/70 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

const chartTooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' };

export default function MetricsTab({ instance }: MetricsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const { data: historyData, isLoading: historyLoading } = useInstanceMetricsHistory(instance.name, timeRange);
  const { data: currentMetrics, isLoading: currentLoading } = useInstanceMetrics(instance.name);
  const { data: systemMetrics } = useSystemMetrics();

  // Aggregate current metrics from per-service data
  const serviceMetrics = currentMetrics as Record<string, { cpu: number | null; memory: number | null; networkRx: number; networkTx: number; diskRead: number; diskWrite: number }> | undefined;
  
  const totalCpu = serviceMetrics
    ? Object.values(serviceMetrics).reduce((sum, s) => sum + (s.cpu ?? 0), 0)
    : null;
  const totalMemMB = serviceMetrics
    ? Object.values(serviceMetrics).reduce((sum, s) => sum + (s.memory ?? 0), 0)
    : null;
  const totalRx = serviceMetrics
    ? Object.values(serviceMetrics).reduce((sum, s) => sum + (s.networkRx ?? 0), 0)
    : null;
  const totalTx = serviceMetrics
    ? Object.values(serviceMetrics).reduce((sum, s) => sum + (s.networkTx ?? 0), 0)
    : null;

  if (currentLoading) {
    return (
      <div className="border rounded-lg p-12 text-center bg-card">
        <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground text-sm">Loading metrics…</p>
      </div>
    );
  }

  if (!serviceMetrics || totalCpu === null) {
    return (
      <div className="border rounded-lg p-12 text-center bg-card">
        <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">No metrics available</p>
        <p className="text-xs text-muted-foreground mt-1">Metrics are collected every 30 seconds</p>
      </div>
    );
  }

  const totalMemGB = totalMemMB! / 1024;
  const hostMemGB: number = (systemMetrics as any)?.host?.totalMemGB ?? 8;
  const memoryPercent = Math.min((totalMemGB / hostMemGB) * 100, 100);
  const cpuPercent = Math.min(totalCpu, 100);

  const chartData = (historyData || []).map((d: any) => ({
    ...d,
    time: format(new Date(d.timestamp), 'HH:mm'),
    memGB: parseFloat((d.memory / 1024).toFixed(2)),
    rxMB: parseFloat((d.networkRx / 1024 / 1024).toFixed(3)),
    txMB: parseFloat((d.networkTx / 1024 / 1024).toFixed(3)),
  }));

  // Per-service bar chart data from both sources
  const serviceBarData = instance.services.map(s => {
    const cur = serviceMetrics[s.name];
    return {
      name: s.name,
      cpu: cur?.cpu ?? s.cpu,
      memory: cur?.memory ?? s.memory,
    };
  });

  return (
    <div className="space-y-4">
      {/* Current usage */}
      <div className="border rounded-lg bg-card p-5">
        <h2 className="text-sm font-medium mb-4">Current Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ProgressBar value={cpuPercent} label="CPU Usage" sub={`${cpuPercent.toFixed(1)}%`} />
          <ProgressBar value={memoryPercent} label="Memory" sub={`${totalMemGB.toFixed(1)} / ${hostMemGB} GB (${memoryPercent.toFixed(0)}%)`} />
        </div>
      </div>

      {/* I/O metrics */}
      <div className="border rounded-lg bg-card p-5">
        <h2 className="text-sm font-medium mb-3">Network & Disk I/O</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Net RX', value: ((totalRx ?? 0) / 1024 / 1024).toFixed(1) + ' MB', Icon: Network },
            { label: 'Net TX', value: ((totalTx ?? 0) / 1024 / 1024).toFixed(1) + ' MB', Icon: TrendingUp },
            { label: 'Disk Read', value: Object.values(serviceMetrics).reduce((s, m) => s + (m.diskRead ?? 0), 0).toFixed(1) + ' MB', Icon: HardDrive },
            { label: 'Disk Write', value: Object.values(serviceMetrics).reduce((s, m) => s + (m.diskWrite ?? 0), 0).toFixed(1) + ' MB', Icon: HardDrive },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="border rounded-md p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Time series */}
      <div className="border rounded-lg bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Resource Trends
          </h2>
          <div className="flex gap-1">
            {(['1h', '6h', '24h', '7d'] as TimeRange[]).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${timeRange === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {historyLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No history data yet</div>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-2">CPU (%)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'CPU']} />
                    <Area type="monotone" dataKey="cpu" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground))" fillOpacity={0.08} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Memory (GB)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} GB`, 'Memory']} />
                    <Area type="monotone" dataKey="memGB" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Network (MB/s)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(3)} MB/s`]} />
                    <Area type="monotone" dataKey="rxMB" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground))" fillOpacity={0.06} strokeWidth={1.5} dot={false} name="RX" />
                    <Area type="monotone" dataKey="txMB" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.06} strokeWidth={1.5} dot={false} name="TX" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Per-service usage */}
      <div className="border rounded-lg bg-card p-5">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Per-Service Usage
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">CPU (%)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviceBarData} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'CPU']} />
                <Bar dataKey="cpu" fill="hsl(var(--foreground))" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Memory (MB)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviceBarData} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(0)} MB`, 'Memory']} />
                <Bar dataKey="memory" fill="hsl(var(--muted-foreground))" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Service table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h2 className="text-sm font-medium">Service Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Service</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">CPU</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Memory</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instance.services.map(service => {
                const cur = serviceMetrics[service.name];
                return (
                  <tr key={service.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-sm">{service.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{service.containerName}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{(cur?.cpu ?? service.cpu).toFixed(1)}%</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{(cur?.memory ?? service.memory).toFixed(0)} MB</td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-muted-foreground">{service.health || '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
