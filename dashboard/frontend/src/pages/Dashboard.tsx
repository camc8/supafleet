import { useState } from 'react';
import { Plus, XCircle, Loader2, Server } from 'lucide-react';
import { useInstances } from '../hooks/useInstances';
import type { SupabaseInstance } from '../types';
import InstanceCard from '../components/InstanceCard';
import CreateInstanceModal from '../components/CreateInstanceModal';

export default function Dashboard() {
  const { data: instances, isLoading, error, refetch } = useInstances();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const healthyCount = instances?.filter((i: SupabaseInstance) => i.health.overall === 'healthy').length ?? 0;
  const totalCount = instances?.length ?? 0;
  const degradedCount = instances?.filter((i: SupabaseInstance) => i.health.overall === 'degraded').length ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="border-b border-border px-6 h-[72px] flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-medium text-foreground">All instances</h1>
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {healthyCount} healthy
              {degradedCount > 0 ? `, ${degradedCount} degraded` : ''}
              {' '}· {totalCount} total
            </p>
          )}
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-80 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New instance
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="border border-border rounded-lg p-8 text-center">
            <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Failed to load instances</p>
            <p className="text-xs text-muted-foreground mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button
              onClick={() => refetch()}
              className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors text-foreground"
            >
              Retry
            </button>
          </div>
        ) : !instances || instances.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">No instances</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first Supabase instance to get started</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-80 transition-opacity"
            >
              <Plus className="w-4 h-4" /> New instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {instances.map((inst: SupabaseInstance) => (
              <InstanceCard key={inst.id} instance={inst} />
            ))}
          </div>
        )}
      </div>

      <CreateInstanceModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
