import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Database, Loader2 } from 'lucide-react';
import { useCreateInstance } from '../hooks/useInstances';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export default function CreateInstanceModal({ open, onOpenChange }: Props) {
  const baseDomain = (import.meta as any).env?.VITE_BASE_DOMAIN || 'db.yourdomain.com';
  const navigate = useNavigate();
  const createInstance = useCreateInstance();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const validate = (v: string) => {
    if (!v) return 'Name is required';
    if (!/^[a-z0-9-]+$/.test(v)) return 'Lowercase letters, numbers, hyphens only';
    if (v.length < 2) return 'At least 2 characters';
    if (v.length > 40) return 'Max 40 characters';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(name);
    if (err) { setError(err); return; }
    setError('');
    try {
      await createInstance.mutateAsync({
        name,
        deploymentType: 'cloud',
        domain: baseDomain,
        protocol: 'https',
      });
      setName('');
      onOpenChange(false);
      navigate(`/instances/${name}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create instance');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl p-8 w-full max-w-md z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-xl font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              New Database
            </Dialog.Title>
            <Dialog.Close className="p-1 hover:bg-muted rounded transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-muted-foreground mb-6">
            Creates a new isolated Supabase instance. Credentials are auto-generated and Nginx is configured automatically.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Database name</label>
              <div className="flex items-center gap-0 border border-border rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border whitespace-nowrap">
                  `${name || 'name'}.${baseDomain}` /
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value.toLowerCase()); setError(''); }}
                  placeholder="my-project"
                  className="flex-1 px-3 py-2.5 bg-background text-sm outline-none"
                  autoFocus
                />
              </div>
              {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">
                API at <span className="font-mono">{name || 'name'}.${baseDomain}/rest/v1/</span>, Studio at <span className="font-mono">{name || 'name'}.${baseDomain}/studio</span>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">What happens on create:</p>
              <p>✓ Isolated Postgres database with fresh credentials</p>
              <p>✓ Docker containers started automatically</p>
              <p>✓ API at <span className="font-mono text-xs">{name || 'name'}.${baseDomain}/rest/v1/</span></p>
              <p>✓ Studio at <span className="font-mono text-xs">{name || 'name'}.${baseDomain}/studio</span></p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={createInstance.isPending}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createInstance.isPending || !name}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createInstance.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Creating...</>
                ) : (
                  <><Plus className="w-4 h-4" />Create</>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
