import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useInstance, useInstanceMetrics, useStartInstance, useStopInstance, useRestartInstance } from '../hooks/useInstances';
import { Loader2, Play, Square, RotateCw, Server, Activity, BarChart3, FileText, Key, ExternalLink } from 'lucide-react';
import ServicesTab from '../components/ServicesTab';
import MetricsTab from '../components/MetricsTab';
import LogsTab from '../components/LogsTab';
import CredentialsTab from '../components/CredentialsTab';

type TabType = 'services' | 'metrics' | 'logs' | 'credentials';

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
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex items-center justify-center flex-1 py-16">
        <div className="text-center">
          <Server className="w-10 h-10 text-gray-700 mx-auto mb-4" />
          <h2 className="text-base font-semibold text-gray-300 mb-1">Instance not found</h2>
          <p className="text-sm text-gray-600 mb-4">"{name}" could not be found</p>
          <Link to="/" className="px-4 py-2 bg-white text-gray-900 rounded-md text-sm hover:bg-gray-100 transition-colors">
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
      <div className="border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <StatusDot status={instance.health.overall} />
            <h1 className="text-base font-medium text-gray-100 font-mono">{instance.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded ml-1 ${
              instance.health.overall === 'healthy' ? 'text-green-300 bg-green-900/30' :
              instance.health.overall === 'degraded' ? 'text-yellow-300 bg-yellow-900/30' :
              instance.health.overall === 'stopped' ? 'text-gray-500 bg-gray-800' :
              'text-red-300 bg-red-900/30'
            }`}>
              {instance.health.overall}
            </span>
            <span className="text-xs text-gray-600 font-mono truncate hidden sm:block ml-2">
              {instance.credentials.project_url}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={instance.credentials.studio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Studio
            </a>
            <button
              onClick={() => restartMutation.mutate(instance.name)}
              disabled={restartMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
              {restartMutation.isPending ? 'Restarting…' : 'Restart'}
            </button>
            {isRunning ? (
              <button
                onClick={() => stopMutation.mutate(instance.name)}
                disabled={stopMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 rounded border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5" />
                {stopMutation.isPending ? 'Stopping…' : 'Stop'}
              </button>
            ) : (
              <button
                onClick={() => startMutation.mutate(instance.name)}
                disabled={startMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white text-gray-900 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {startMutation.isPending ? 'Starting…' : 'Start'}
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-gray-600 mb-0.5">Services</div>
            <div className="text-sm font-mono text-gray-300">{instance.health.healthyServices}/{instance.health.totalServices}</div>
          </div>
          {currentMetrics ? (
            <>
              <div>
                <div className="text-xs text-gray-600 mb-0.5">CPU</div>
                <div className="text-sm font-mono text-gray-300">
                  {Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.cpu ?? 0), 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-0.5">Memory</div>
                <div className="text-sm font-mono text-gray-300">
                  {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.memory ?? 0), 0) / 1024).toFixed(1)} GB
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-0.5">Network</div>
                <div className="text-sm font-mono text-gray-300">
                  {(Object.values(currentMetrics as Record<string, any>).reduce((s: number, m: any) => s + (m.networkRx ?? 0) + (m.networkTx ?? 0), 0) / 1024 / 1024).toFixed(0)} MB
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6 flex gap-1 flex-shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-300 text-gray-200'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'services' && <ServicesTab instance={instance} />}
        {activeTab === 'metrics' && <MetricsTab instance={instance} />}
        {activeTab === 'logs' && <LogsTab instance={instance} />}
        {activeTab === 'credentials' && <CredentialsTab instance={instance} />}
      </div>
    </div>
  );
}
