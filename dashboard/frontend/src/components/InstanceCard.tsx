import { Link, useNavigate } from 'react-router-dom';
import type { SupabaseInstance } from '../types';
import { ExternalLink, Play, Square, ChevronRight } from 'lucide-react';
import { useStartInstance, useStopInstance } from '../hooks/useInstances';

interface InstanceCardProps {
  instance: SupabaseInstance;
}

function StatusDot({ status }: { status: string }) {
  const isRunning = status === 'healthy';
  const isDegraded = status === 'degraded';
  const isStopped = status === 'stopped';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
        isRunning
          ? 'bg-foreground'
          : isDegraded
          ? 'bg-muted-foreground'
          : isStopped
          ? 'bg-muted-foreground/40'
          : 'bg-destructive'
      }`}
    />
  );
}

export default function InstanceCard({ instance }: InstanceCardProps) {
  const navigate = useNavigate();
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();

  const isRunning = instance.health.overall === 'healthy' || instance.status === 'running';
  const healthPct = instance.health.totalServices > 0
    ? (instance.health.healthyServices / instance.health.totalServices) * 100
    : 0;

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await startMutation.mutateAsync(instance.name);
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Stop ${instance.name}?`)) {
      await stopMutation.mutateAsync(instance.name);
    }
  };

  return (
    <div className="border rounded-lg bg-card hover:border-foreground/20 transition-colors">
      {/* Header */}
      <Link to={`/instances/${instance.name}`} className="block p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={instance.health.overall} />
              <span className="font-semibold text-sm truncate">{instance.name}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono">
              {instance.credentials.project_url}
            </p>
          </div>
          <span className="text-xs text-muted-foreground capitalize flex-shrink-0 mt-0.5">
            {instance.health.overall}
          </span>
        </div>

        {/* Health bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Services</span>
            <span>{instance.health.healthyServices}/{instance.health.totalServices}</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground/70 rounded-full transition-all"
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="px-5 pb-5 flex items-center gap-2 border-t pt-4">
        {isRunning ? (
          <button
            onClick={handleStop}
            disabled={stopMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Square className="w-3 h-3" />
            {stopMutation.isPending ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={startMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            {startMutation.isPending ? 'Starting…' : 'Start'}
          </button>
        )}

        <a
          href={instance.credentials.studio_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Studio
        </a>

        <button
          onClick={() => navigate(`/instances/${instance.name}`)}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
