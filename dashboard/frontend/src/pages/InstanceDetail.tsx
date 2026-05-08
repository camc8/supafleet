import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useInstance, useInstanceMetrics, useStartInstance, useStopInstance, useRestartInstance, useDeleteInstance } from '../hooks/useInstances';
import { Loader2, Play, Square, RotateCw, Server, Activity, BarChart3, FileText, Key, ExternalLink, Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import ServicesTab from '../components/ServicesTab';
import MetricsTab from '../components/MetricsTab';
import LogsTab from '../components/LogsTab';
import CredentialsTab from '../components/CredentialsTab';

type TabType = 'services' | 'metrics' | 'logs' | 'credentials';

function statusBadgeClass(status: string) {
  if (status === 'healthy')  return 'text-green-700  bg-green-50   dark:text-green-300  dark:bg-green-900/30';
  if (status === 'degraded') return 'text-yellow-700 bg-yellow-50  dark:text-yellow-300 dark:bg-yellow-900/30';
  if (status === 'stopped')  return 'text-gray-500   bg-gray-100   dark:text-gray-500   dark:bg-gray-800';
  return                            'text-red-700    bg-red-50     dark:text-red-300    dark:bg-red-900/30';
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      status === 'healthy'   ? 'bg-green-500  dark:bg-green-400'  :
      status === 'degraded'  ? 'bg-yellow-500 dark:bg-yellow-400' :
      status === 'unhealthy' ? 'bg-red-500    dark:bg-red-400'    :
      'bg-gray-300 dark:bg-gray-600'
    }`} />
  );
}

function DeleteModal({ instanceName }: { instanceName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [removeVolumes, setRemoveVolumes] = useState(false);
  const navigate = useNavigate();
  const deleteMutation = useDeleteInstance();

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ name: instanceName, removeVolumes });
    setOpen(false);
    navigate('/');
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirm(''); setRemoveVolumes(false); } }}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background border rounded-lg shadow-lg p-6 focus:outline-none">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-red-600 dark:text-red-400">
              Delete instance
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            This will stop and remove all Docker containers for{' '}
            <span className="font-mono font-medium text-foreground">{instanceName}</span>{' '}
            along with its nginx routing config. This cannot be undone.
          </p>

          <label className="flex items-start gap-2.5 mb-5 cursor-pointer group">
            <input
              type="checkbox"
              checked={removeVolumes}
              onChange={e => setRemoveVolumes(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <div>
              <p className="text-sm font-medium">Also delete data volumes</p>
              <p className="text-xs text-muted-foreground">Permanently removes the Postgres database and all stored data.</p>
            </div>
          </label>

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">
              Type <span className="font-mono font-medium text-foreground">{instanceName}</span> to confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={instanceName}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Dialog.Close asChild>
              <button className="px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleDelete}
              disabled={confirm !== instanceName || deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleteMutation.isPending ? 'Deleting…' : 'Delete instance'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function InstanceDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('services');

  const { data: instance, isLoading, error } = useInstance(name!);
  const { data: currentMetrics } = useInstanceMetrics(name!);
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();
  const restartMutation = useRestartInstance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex items-center justify-center flex-1 py-16">
        <div className="text-center">
          <Server className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-base font-semibold mb-1">Instance not found</h2>
          <p className="text-sm text-muted-foreground mb-4">"{name}" could not be found</p>
          <Link to="/" className="px-4 py-2 bg-foreground text-background rounded-md text-sm hover:opacity-90 transition-opacity">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isRunning = instance.health.overall === 'healthy' || instance.status === 'running';

  const tabs = [
    { id: 'services' as TabType, label: 'Services', icon: Activity },
    { id: 'metrics' as TabType, label: 'Metrics', icon: BarChart3 },
    { id: 'logs' as TabType, label: 'Logs', icon: FileText },
    { id: 'credentials' as TabType, label: 'Credentials', icon: Key },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex-shrink-0 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <StatusDot status={instance.health.overall} />
            <h1 className="text-base font-medium font-mono">{instance.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded ml-1 ${statusBadgeClass(instance.health.overall)}`}>
              {instance.health.overall}
            </span>
            <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block ml-2">
              {instance.credentials.project_url}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={instance.credentials.studio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Studio
            </a>
            <button
              onClick={() => restartMutation.mutate(instance.name)}
              disabled={restartMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
              {restartMutation.isPending ? 'Restarting…' : 'Restart'}
            </button>
            {isRunning ? (
              <button
                onClick={() => stopMutation.mutate(instance.name)}
                disabled={stopMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5" />
                {stopMutation.isPending ? 'Stopping…' : 'Stop'}
              </button>
            ) : (
              <button
                onClick={() => startMutation.mutate(instance.name)}
                disabled={startMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {startMutation.isPending ? 'Starting…' : 'Start'}
              </button>
            )}
            <DeleteModal instanceName={instance.name} />
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Services</div>
            <div className="text-sm font-mono">{instance.health.healthyServices}/{instance.health.totalServices}</div>
          </div>
          {currentMetrics ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">CPU</div>
                <div className="text-sm font-mono">
                  {Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.cpu ?? 0), 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Memory</div>
                <div className="text-sm font-mono">
                  {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.memory ?? 0), 0) / 1024).toFixed(1)} GB
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Network</div>
                <div className="text-sm font-mono">
                  {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.networkRx ?? 0) + (m.networkTx ?? 0), 0) / 1024 / 1024).toFixed(0)} MB
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6 flex gap-1 flex-shrink-0 bg-card">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6 overflow-auto bg-background">
        {activeTab === 'services' && <ServicesTab instance={instance} />}
        {activeTab === 'metrics' && <MetricsTab instance={instance} />}
        {activeTab === 'logs' && <LogsTab instance={instance} />}
        {activeTab === 'credentials' && <CredentialsTab instance={instance} />}
      </div>
    </div>
  );
}
