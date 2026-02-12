import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AdminInstanceView, AdminTokenView } from '@aws-gaming/contracts';
import type { UpdateTokenInput } from '@/hooks/use-admin-tokens';

const EXPIRY_PRESETS: readonly { label: string; days: number | null }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'Never', days: null },
];

type ExpiryChoice = 'keep' | number | null;

interface EditTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: AdminTokenView;
  instances: AdminInstanceView[];
  onSave: (tokenId: string, input: UpdateTokenInput) => Promise<void>;
}

function calculateExpiresAt(days: number | null): string | null {
  if (days === null) return null;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}

export function EditTokenDialog({
  open,
  onOpenChange,
  token,
  instances,
  onSave,
}: EditTokenDialogProps) {
  const [label, setLabel] = useState(token.label);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(token.instanceIds),
  );
  const [isAdmin, setIsAdmin] = useState(token.isAdmin === true);
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>('keep');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(token.label);
    setSelectedIds(new Set(token.instanceIds));
    setIsAdmin(token.isAdmin === true);
    setExpiryChoice('keep');
    setError(null);
  }, [token]);

  function toggleInstance(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // TODO we are tracking error/loading manually, this should probably be using TanStack Query
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || selectedIds.size === 0 || submitting) return;

    setSubmitting(true);
    setError(null);

    const input: UpdateTokenInput = {
      label: label.trim(),
      instanceIds: Array.from(selectedIds),
      isAdmin,
    };

    if (expiryChoice !== 'keep') {
      input.expiresAt = calculateExpiresAt(expiryChoice);
    }

    try {
      await onSave(token.id, input);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = label.trim().length > 0 && selectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Token</DialogTitle>
            <DialogDescription>
              Update the label, admin rights, or server access for this token.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="edit-token-label"
                className="block text-sm font-medium text-foreground"
              >
                Label
              </label>
              <input
                id="edit-token-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                Server access
              </p>
              {instances.length === 0 ? (
                <p className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  No game instances found. Existing server access will be kept until instances are available again.
                </p>
              ) : (
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
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Expiry</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Current:{' '}
                {token.expiresAt
                  ? new Date(token.expiresAt).toLocaleString()
                  : 'Never'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpiryChoice('keep')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    expiryChoice === 'keep'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  Keep current
                </button>
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setExpiryChoice(preset.days)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      expiryChoice === preset.days
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="rounded border-border"
              />
              Grant admin access
            </label>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
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
              disabled={!isValid || submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
