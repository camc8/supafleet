import { Link, useNavigate } from 'react-router-dom';
import type { SupabaseInstance } from '../types';
import { ExternalLink, Play, Square, ChevronRight } from 'lucide-react';
import { useStartInstance, useStopInstance } from '../hooks/useInstances';

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      status === 'healthy' ? 'bg-green-400' :
      status === 'degraded' ? 'bg-yellow-400' :
      status === 'unhealthy' ? 'bg-red-400' :
      'bg-gray-600'
    }`} />
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full bg-gray-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function InstanceCard({ instance }: { instance: SupabaseInstance }) {
  const navigate = useNavigate();
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();

  const isRunning = instance.health.overall === 'healthy' || instance.status === 'running';
  const healthPct = instance.health.totalServices > 0
    ? (instance.health.healthyServices / instance.health.totalServices) * 100
    : 0;

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    await startMutation.mutateAsync(instance.name);
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm(`Stop ${instance.name}?`)) await stopMutation.mutateAsync(instance.name);
  };

  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900 hover:border-gray-600 transition-colors">
      <Link to={`/instances/${instance.name}`} className="block p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={instance.health.overall} />
              <span className="font-medium text-sm text-gray-100 truncate font-mono">{instance.name}</span>
            </div>
            <p className="text-xs text-gray-600 truncate font-mono">
              {instance.credentials.project_url}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${
            instance.health.overall === 'healthy' ? 'text-green-300 bg-green-900/30' :
            instance.health.overall === 'degraded' ? 'text-yellow-300 bg-yellow-900/30' :
            instance.health.overall === 'stopped' ? 'text-gray-500 bg-gray-800' :
            'text-red-300 bg-red-900/30'
          }`}>
            {instance.health.overall}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Services</span>
            <span className="text-gray-400">{instance.health.healthyServices}/{instance.health.totalServices}</span>
          </div>
          <MiniBar value={healthPct} max={100} />
        </div>
      </Link>

      <div className="px-4 pb-4 flex items-center gap-2 border-t border-gray-800 pt-3">
        {isRunning ? (
          <button
            onClick={handleStop}
            disabled={stopMutation.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Square className="w-3 h-3" />
            {stopMutation.isPending ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={startMutation.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            {startMutation.isPending ? 'Starting…' : 'Start'}
          </button>
        )}
        <a
          href={instance.credentials.studio_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Studio
        </a>
        <button
          onClick={() => navigate(`/instances/${instance.name}`)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
