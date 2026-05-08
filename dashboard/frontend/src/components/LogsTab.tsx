import { useState, useEffect, useRef } from 'react';
import type { SupabaseInstance } from '../types';
import { useInstanceLogs } from '../hooks/useInstances';
import { useWebSocket } from '../hooks/useWebSocket';
import { Download, RefreshCw } from 'lucide-react';

interface LogsTabProps { instance: SupabaseInstance; }

// Strip Docker log multiplexing binary headers for display
function cleanLogLine(line: string): string {
  return line.replace(/[\x00-\x08\x0e-\x1f\x7f]/g, '');
}

export default function LogsTab({ instance }: LogsTabProps) {
  const [selectedService, setSelectedService] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: fetchedLogs, refetch, isLoading } = useInstanceLogs(
    instance.name,
    selectedService || undefined,
    100
  );

  const { subscribeLogs, unsubscribeLogs, onLogs, offLogs } = useWebSocket();

  useEffect(() => {
    if (typeof fetchedLogs === 'string' && fetchedLogs) {
      setLogs(fetchedLogs.split('\n').filter(Boolean).map(cleanLogLine));
    } else if (Array.isArray(fetchedLogs)) {
      setLogs((fetchedLogs as string[]).map(cleanLogLine));
    }
  }, [fetchedLogs]);

  useEffect(() => {
    subscribeLogs(instance.name, selectedService || undefined);
    const handleLogData = (data: any) => {
      if (data.logs) {
        setLogs(prev => [...prev, ...data.logs.split('\n').filter(Boolean).map(cleanLogLine)].slice(-500));
      }
    };
    onLogs(handleLogData);
    return () => {
      offLogs(handleLogData);
      unsubscribeLogs();
    };
  }, [instance.name, selectedService]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instance.name}-${selectedService || 'all'}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <select
              value={selectedService}
              onChange={e => { setSelectedService(e.target.value); setLogs([]); }}
              className="text-sm px-3 py-1.5 border rounded-md bg-background focus:outline-none focus-visible:border-foreground/40"
            >
              <option value="">All Services</option>
              {instance.services.map(svc => (
                <option key={svc.name} value={svc.name}>{svc.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                className="rounded border-border"
              />
              Auto-scroll
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetch(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              onClick={handleDownload}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
          <span className="text-sm font-medium">{selectedService || 'All Services'}</span>
          <span className="text-xs text-muted-foreground">{logs.length} lines</span>
        </div>
        <div className="h-[600px] overflow-y-auto bg-muted/30 font-mono text-xs">
          <div className="p-4">
            {isLoading ? (
              <div className="text-muted-foreground text-center py-12 text-sm">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-12 text-sm">
                No logs available. They will appear here in real-time.
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="hover:bg-muted/40 px-2 py-0.5 rounded leading-5">
                  <span className="text-muted-foreground/50 mr-3 select-none">{i + 1}</span>
                  <span className="text-foreground/80 break-all">{log}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
