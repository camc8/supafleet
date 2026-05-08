import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useInstance, useInstanceMetrics, useStartInstance, useStopInstance, useRestartInstance } from '../hooks/useInstances';
import { Loader2, ChevronLeft, Play, Square, RotateCw, Server, Activity, BarChart3, FileText, Key, ExternalLink } from 'lucide-react';
import ServicesTab from '../components/ServicesTab';
import MetricsTab from '../components/MetricsTab';
import LogsTab from '../components/LogsTab';
import CredentialsTab from '../components/CredentialsTab';

type TabType = 'services' | 'metrics' | 'logs' | 'credentials';

function StatusDot({ status }: { status: string }) {
  const isHealthy = status === 'healthy';
  const isStopped = status === 'stopped';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
        isHealthy ? 'bg-foreground' : isStopped ? 'bg-muted-foreground/40' : status === 'degraded' ? 'bg-muted-foreground' : 'bg-destructive'
      }`}
    />
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Server className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">Instance not found</h2>
          <p className="text-sm text-muted-foreground mb-4">"{name}" could not be found</p>
          <Link to="/" className="px-4 py-2 bg-foreground text-background rounded-md text-sm hover:opacity-90">
            Back to Dashboard
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <StatusDot status={instance.health.overall} />
              <h1 className="text-lg font-semibold">{instance.name}</h1>
              <span className="text-sm text-muted-foreground capitalize">{instance.health.overall}</span>
              <span className="text-muted-foreground/30 mx-1">·</span>
              <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block">
                {instance.credentials.project_url}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={instance.credentials.studio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Studio
              </a>
              <button
                onClick={() => restartMutation.mutate(instance.name)}
                disabled={restartMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
                {restartMutation.isPending ? 'Restarting…' : 'Restart'}
              </button>
              {isRunning ? (
                <button
                  onClick={() => stopMutation.mutate(instance.name)}
                  disabled={stopMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5" />
                  {stopMutation.isPending ? 'Stopping…' : 'Stop'}
                </button>
              ) : (
                <button
                  onClick={() => startMutation.mutate(instance.name)}
                  disabled={startMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {startMutation.isPending ? 'Starting…' : 'Start'}
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-md p-3 bg-background">
              <p className="text-xs text-muted-foreground mb-1">Services</p>
              <p className="text-xl font-semibold">{instance.health.healthyServices}/{instance.health.totalServices}</p>
              <p className="text-xs text-muted-foreground">healthy</p>
            </div>
            {currentMetrics ? (
              <>
                <div className="border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">CPU</p>
                  <p className="text-xl font-semibold">
                    {Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.cpu ?? 0), 0).toFixed(1)}%
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Memory</p>
                  <p className="text-xl font-semibold">
                    {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.memory ?? 0), 0) / 1024).toFixed(1)} GB
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Network</p>
                  <p className="text-xl font-semibold">
                    {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.networkRx ?? 0) + (m.networkTx ?? 0), 0) / 1024 / 1024).toFixed(0)} MB
                  </p>
                </div>
              </>
            ) : (
              <div className="border rounded-md p-3 bg-background col-span-3">
                <p className="text-xs text-muted-foreground">Loading metrics…</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-foreground text-foreground font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 'services' && <ServicesTab instance={instance} />}
        {activeTab === 'metrics' && <MetricsTab instance={instance} />}
        {activeTab === 'logs' && <LogsTab instance={instance} />}
        {activeTab === 'credentials' && <CredentialsTab instance={instance} />}
      </main>
    </div>
  );
}
