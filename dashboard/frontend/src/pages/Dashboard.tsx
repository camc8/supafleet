import { useState } from 'react';
import { Plus, XCircle, Loader2 } from 'lucide-react';
import { useInstances, useSystemMetrics } from '../hooks/useInstances';
import type { SupabaseInstance } from '../types';
import InstanceCard from '../components/InstanceCard';
import CreateInstanceModal from '../components/CreateInstanceModal';

interface Props { ThemeToggle: React.ComponentType }

export default function Dashboard({ ThemeToggle }: Props) {
  const { data: instances, isLoading, error, refetch } = useInstances();
  const { data: systemMetrics } = useSystemMetrics();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const host = (systemMetrics as any)?.host;
  const memPercent: number = host?.memPercent ?? 0;
  const usedGB: number = host?.usedMemGB ?? 0;
  const totalGB: number = host?.totalMemGB ?? 0;
  const healthyCount = instances?.filter((i: SupabaseInstance) => i.health.overall === 'healthy').length ?? 0;
  const totalCount = instances?.length ?? 0;
  const serviceCount = instances?.reduce(
    (sum: number, inst: SupabaseInstance) =>
      sum + inst.services.filter((sv) => sv.status === 'running' || sv.health === 'healthy').length,
    0
  ) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/supafleet-icon.png" className="h-7 w-7" alt="Supafleet" />
            <span style={{fontFamily: '"DM Serif Display", serif'}} className="text-lg tracking-tight">Supafleet</span>
          </div>
          <div className="flex items-center gap-2">

            <ThemeToggle />
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Instance
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Server resource bar */}
        {host && (
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Server Resources</span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>RAM: {usedGB.toFixed(1)} / {totalGB.toFixed(1)} GB ({memPercent}%)</span>
                <span>{host.cpuCount} vCPU</span>
                <span className={`font-medium ${memPercent > 85 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {memPercent > 85 ? 'Critical' : memPercent > 65 ? 'High' : 'OK'}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${memPercent > 85 ? 'bg-destructive' : 'bg-foreground/60'}`}
                style={{ width: `${Math.min(memPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground mb-1">Instances</p>
            <p className="text-2xl font-semibold">{totalCount}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground mb-1">Healthy</p>
            <p className="text-2xl font-semibold">{healthyCount}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground mb-1">Services Running</p>
            <p className="text-2xl font-semibold">{serviceCount}</p>
          </div>
        </div>

        {/* Instances grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="border rounded-lg p-8 text-center bg-card">
            <XCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Failed to load instances</p>
            <p className="text-xs text-muted-foreground mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button onClick={() => refetch()} className="text-sm px-3 py-1.5 border rounded-md hover:bg-muted transition-colors">
              Retry
            </button>
          </div>
        ) : !instances || instances.length === 0 ? (
          <div className="border border-dashed rounded-lg p-12 text-center bg-card">
            <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No instances</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first Supabase instance to get started</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> New Instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.map((inst: SupabaseInstance) => <InstanceCard key={inst.id} instance={inst} />)}
          </div>
        )}
      </main>

      <CreateInstanceModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
