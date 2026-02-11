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
import type { AdminInstanceView, AdminTokenView } from '@/lib/mock-admin-data';
import type { UpdateTokenInput } from '@/hooks/use-mock-tokens';

interface EditTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: AdminTokenView;
  instances: AdminInstanceView[];
  onSave: (tokenId: string, input: UpdateTokenInput) => void;
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

  // Sync form when token changes
  useEffect(() => {
    setLabel(token.label);
    setSelectedIds(new Set(token.instanceIds));
  }, [token]);

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

    onSave(token.id, {
      label: label.trim(),
      instanceIds: Array.from(selectedIds),
    });
    onOpenChange(false);
  }

  const isValid = label.trim().length > 0 && selectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Token</DialogTitle>
            <DialogDescription>
              Update the label or server access for this token.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Label */}
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
              Save Changes
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
