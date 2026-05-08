import { Link, useLocation } from 'react-router-dom';
import { Plus, Moon, Sun } from 'lucide-react';
import { useInstances, useSystemMetrics } from '../hooks/useInstances';
import type { SupabaseInstance } from '../types';
import CreateInstanceModal from './CreateInstanceModal';
import { useState } from 'react';

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

interface LayoutProps {
  children: React.ReactNode;
  toggleDark: () => void;
  dark: boolean;
}

export default function Layout({ children, toggleDark, dark }: LayoutProps) {
  const location = useLocation();
  const { data: instances } = useInstances();
  const { data: systemMetrics } = useSystemMetrics();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const host = (systemMetrics as any)?.host;
  const memPercent = host?.memPercent ?? 0;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-border flex-shrink-0 bg-card">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/supafleet-icon.png" className="h-10 w-10 rounded-xl" alt="Supafleet" />
            <span className="text-lg font-semibold tracking-tight">Supafleet</span>
          </Link>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Instance list */}
        <div className="flex-1 overflow-auto py-3 min-h-0">
          <div className="px-3 flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide px-1">Instances</span>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs bg-muted hover:bg-accent text-muted-foreground px-2 py-1 rounded transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> New
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
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
          <div className="border-t border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">Server</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">CPU</span>
                <span>{host.cpuCount} vCPU</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Memory</span>
                  <span>{host.usedMemGB?.toFixed(1)} / {host.totalMemGB?.toFixed(0)} GB</span>
                </div>
                <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${memPercent > 85 ? 'bg-destructive' : 'bg-gray-400 dark:bg-gray-500'}`}
                    style={{ width: `${Math.min(memPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {children}
      </main>

      <CreateInstanceModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
