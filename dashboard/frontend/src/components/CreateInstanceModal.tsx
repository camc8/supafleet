import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Loader2 } from 'lucide-react';
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
    if (!/^[a-z0-9-]+$/.test(v)) return 'Lowercase letters, numbers, and hyphens only';
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
      await createInstance.mutateAsync({ name, deploymentType: 'cloud', domain: baseDomain, protocol: 'https' });
      setName('');
      onOpenChange(false);
      navigate(`/instances/${name}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create instance');
    }
  };

  const displayName = name || 'my-project';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border rounded-xl shadow-xl p-6 w-full max-w-sm z-50">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold">New instance</Dialog.Title>
            <Dialog.Close className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setError(''); }}
                placeholder="my-project"
                className="w-full px-3 py-2 bg-background border rounded-md text-sm outline-none focus:border-foreground/40 transition-colors"
                autoFocus
              />
              {error
                ? <p className="mt-1.5 text-xs text-destructive">{error}</p>
                : <p className="mt-1.5 text-xs text-muted-foreground font-mono">{displayName}.{baseDomain}</p>
              }
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded-md p-3">
              <p className="font-mono">{displayName}.{baseDomain}/rest/v1/</p>
              <p className="font-mono">{displayName}.{baseDomain}/studio</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { onOpenChange(false); setName(''); setError(''); }}
                disabled={createInstance.isPending}
                className="flex-1 px-3 py-2 border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createInstance.isPending || !name}
                className="flex-1 px-3 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {createInstance.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</>
                  : <><Plus className="w-3.5 h-3.5" />Create</>
                }
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
