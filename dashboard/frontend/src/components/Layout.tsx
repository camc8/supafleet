import { Link, useLocation } from 'react-router-dom';
import { Plus, Moon, Sun, Menu, X } from 'lucide-react';
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

function SidebarContent({
  instances,
  host,
  memPercent,
  location,
  onNavigate,
  onCreateOpen,
}: {
  instances: SupabaseInstance[] | undefined;
  host: any;
  memPercent: number;
  location: ReturnType<typeof useLocation>;
  onNavigate: () => void;
  onCreateOpen: () => void;
}) {
  return (
    <>
      {/* Instance list */}
      <div className="flex-1 overflow-auto py-3 min-h-0">
        <div className="px-3 flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide px-1">Instances</span>
          <button
            onClick={onCreateOpen}
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
                onClick={onNavigate}
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
    </>
  );
}

export default function Layout({ children, toggleDark, dark }: LayoutProps) {
  const location = useLocation();
  const { data: instances } = useInstances();
  const { data: systemMetrics } = useSystemMetrics();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const host = (systemMetrics as any)?.host;
  const memPercent = host?.memPercent ?? 0;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border flex-shrink-0 bg-card">
        <div className="px-4 h-[72px] border-b border-border flex items-center justify-between">
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
        <SidebarContent
          instances={instances}
          host={host}
          memPercent={memPercent}
          location={location}
          onNavigate={() => {}}
          onCreateOpen={() => setIsCreateOpen(true)}
        />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-card border-r border-border transform transition-transform duration-200 md:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-4 h-[72px] border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src="/supafleet-icon.png" className="h-9 w-9 rounded-xl" alt="Supafleet" />
            <span className="text-lg font-semibold tracking-tight">Supafleet</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <SidebarContent
          instances={instances}
          host={host}
          memPercent={memPercent}
          location={location}
          onNavigate={() => setSidebarOpen(false)}
          onCreateOpen={() => { setIsCreateOpen(true); setSidebarOpen(false); }}
        />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-12 border-b border-border bg-card flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/supafleet-icon.png" className="h-7 w-7 rounded-lg" alt="Supafleet" />
            <span className="text-sm font-semibold tracking-tight">Supafleet</span>
          </Link>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          {children}
        </main>
      </div>

      <CreateInstanceModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
