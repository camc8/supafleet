import { useState } from 'react';
import type { SupabaseInstance } from '../types';
import { Eye, EyeOff, Copy, Check, Key, Link as LinkIcon, Database, AlertTriangle } from 'lucide-react';

interface CredentialItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  isSecret?: boolean;
}

function CredentialItem({ label, value, icon, isSecret = false }: CredentialItemProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const displayValue = isSecret && !isRevealed ? '•'.repeat(24) : value;

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-foreground/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-muted rounded-md flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
          <div className="flex items-center gap-2">
            <code className="block px-3 py-2 bg-muted rounded text-xs font-mono break-all flex-1 text-foreground">
              {displayValue}
            </code>
            <div className="flex gap-1 flex-shrink-0">
              {isSecret && (
                <button
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                  title={isRevealed ? 'Hide' : 'Reveal'}
                >
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                title="Copy"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-foreground" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CredentialsTab({ instance }: { instance: SupabaseInstance }) {
  const credentials = [
    { label: 'Project URL', value: instance.credentials.project_url, icon: <LinkIcon className="w-4 h-4 text-muted-foreground" />, isSecret: false },
    { label: 'Anon Key', value: instance.credentials.anon_key, icon: <Key className="w-4 h-4 text-muted-foreground" />, isSecret: true },
    { label: 'Service Role Key', value: instance.credentials.service_role_key, icon: <Key className="w-4 h-4 text-muted-foreground" />, isSecret: true },
    { label: 'JWT Secret', value: instance.credentials.jwt_secret, icon: <Key className="w-4 h-4 text-muted-foreground" />, isSecret: true },
    { label: 'Postgres Password', value: instance.credentials.postgres_password, icon: <Database className="w-4 h-4 text-muted-foreground" />, isSecret: true },
    { label: 'Dashboard Username', value: instance.credentials.dashboard_username, icon: <Key className="w-4 h-4 text-muted-foreground" />, isSecret: false },
    { label: 'Dashboard Password', value: instance.credentials.dashboard_password, icon: <Key className="w-4 h-4 text-muted-foreground" />, isSecret: true },
  ];

  return (
    <div className="space-y-4">
      {/* Warning */}
      <div className="border border-border rounded-lg p-4 bg-muted/40 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground mb-0.5">Sensitive information</p>
          <p className="text-xs text-muted-foreground">
            These credentials provide full access to your instance. Keep them secure and never share them publicly.
          </p>
        </div>
      </div>

      {/* Credentials */}
      <div className="grid gap-3">
        {credentials.map(c => (
          <CredentialItem key={c.label} {...c} />
        ))}
      </div>

      {/* Ports */}
      {instance.ports && Object.keys(instance.ports).length > 0 && (
        <div className="border border-border rounded-lg p-5 bg-card">
          <h2 className="text-sm font-medium mb-3">Port mappings</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(instance.ports).map(([service, port]) => (
              <div key={service} className="border border-border rounded p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground capitalize mb-1">{service.replace(/_/g, ' ')}</p>
                <p className="text-sm font-mono font-medium">{port || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instance info */}
      <div className="border border-border rounded-lg p-5 bg-card">
        <h2 className="text-sm font-medium mb-3">Instance info</h2>
        <div className="space-y-2.5 text-sm">
          {[
            { label: 'ID', value: instance.id },
            { label: 'Name', value: instance.name },
            { label: 'Status', value: instance.status },
            { label: 'Created', value: new Date(instance.createdAt).toLocaleString() },
            { label: 'Updated', value: new Date(instance.updatedAt).toLocaleString() },
          ].map(row => (
            <div key={row.label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono text-xs text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
