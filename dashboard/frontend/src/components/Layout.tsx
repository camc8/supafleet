import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useInstances, useSystemMetrics } from '../hooks/useInstances';
import type { SupabaseInstance } from '../types';
import CreateInstanceModal from './CreateInstanceModal';

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

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: instances } = useInstances();
  const { data: systemMetrics } = useSystemMetrics();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const host = (systemMetrics as any)?.host;
  const memPercent = host?.memPercent ?? 0;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-gray-800 flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-3">
            <img src="/supafleet-icon.png" className="h-10 w-10 rounded-xl" alt="Supafleet" />
            <span style={{fontFamily: '"Playfair Display", serif'}} className="text-xl tracking-tight">Supafleet</span>
          </Link>
        </div>

        {/* Instance list */}
        <div className="flex-1 overflow-auto py-3 min-h-0">
          <div className="px-3 flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide px-1">Instances</span>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors"
            >
              + New
            </button>
          </div>
          <div className="space-y-0.5 px-2">
            {instances?.map((inst: SupabaseInstance) => {
              const isActive = location.pathname === `/instances/${inst.name}`;
              return (
                <Link
                  key={inst.name}
                  to={`/instances/${inst.name}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-gray-100'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                  }`}
                >
                  <StatusDot status={inst.health.overall} />
                  <span className="font-mono text-xs truncate">{inst.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Server stats */}
        {host && (
          <div className="border-t border-gray-800 p-4">
            <div className="text-xs text-gray-600 mb-2">Server</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">CPU</span>
                <span className="text-gray-400">{host.cpuCount} vCPU</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Memory</span>
                  <span className="text-gray-400">
                    {host.usedMemGB?.toFixed(1)} / {host.totalMemGB?.toFixed(0)} GB
                  </span>
                </div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${memPercent > 85 ? 'bg-red-500' : 'bg-gray-500'}`}
                    style={{ width: `${Math.min(memPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {children}
      </main>

      <CreateInstanceModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
