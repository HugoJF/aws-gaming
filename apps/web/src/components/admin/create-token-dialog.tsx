import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AdminInstanceView } from '@/lib/mock-admin-data';
import type { CreateTokenInput } from '@/hooks/use-mock-tokens';

const EXPIRY_PRESETS: readonly { label: string; days: number | null }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'Never', days: null },
];

interface CreateTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: AdminInstanceView[];
  onCreate: (input: CreateTokenInput) => void;
}

export function CreateTokenDialog({
  open,
  onOpenChange,
  instances,
  onCreate,
}: CreateTokenDialogProps) {
  const [label, setLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expiryDays, setExpiryDays] = useState<number | null>(30);

  function toggleInstance(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || selectedIds.size === 0) return;

    onCreate({
      label: label.trim(),
      instanceIds: Array.from(selectedIds),
      expiryDays,
    });

    // Reset form
    setLabel('');
    setSelectedIds(new Set());
    setExpiryDays(30);
    onOpenChange(false);
  }

  const isValid = label.trim().length > 0 && selectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Access Token</DialogTitle>
            <DialogDescription>
              Generate a shareable link that grants access to selected servers.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Label */}
            <div>
              <label
                htmlFor="token-label"
                className="block text-sm font-medium text-foreground"
              >
                Label
              </label>
              <input
                id="token-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Hugo personal"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Instance checkboxes */}
            <div>
              <p className="text-sm font-medium text-foreground">
                Server access
              </p>
              <div className="mt-2 space-y-1.5">
                {instances.map((inst) => (
                  <label
                    key={inst.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                      selectedIds.has(inst.id)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inst.id)}
                      onChange={() => toggleInstance(inst.id)}
                      className="rounded border-border"
                    />
                    <span className="font-medium text-foreground">
                      {inst.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inst.gameLabel}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiry presets */}
            <div>
              <p className="text-sm font-medium text-foreground">Expiry</p>
              <div className="mt-2 flex gap-2">
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setExpiryDays(preset.days)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      expiryDays === preset.days
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Create Token
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
