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
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-medium text-gray-100">All instances</h1>
          {totalCount > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {healthyCount} healthy
              {degradedCount > 0 ? `, ${degradedCount} degraded` : ''}
              {' '}· {totalCount} total
            </p>
          )}
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-900 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New instance
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : error ? (
          <div className="border border-gray-800 rounded-lg p-8 text-center">
            <XCircle className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-300 mb-1">Failed to load instances</p>
            <p className="text-xs text-gray-600 mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button
              onClick={() => refetch()}
              className="text-sm px-3 py-1.5 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors text-gray-300"
            >
              Retry
            </button>
          </div>
        ) : !instances || instances.length === 0 ? (
          <div className="border border-dashed border-gray-800 rounded-lg p-12 text-center">
            <Server className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="font-medium text-gray-300 mb-1">No instances</p>
            <p className="text-sm text-gray-600 mb-4">Create your first Supabase instance to get started</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-900 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
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
