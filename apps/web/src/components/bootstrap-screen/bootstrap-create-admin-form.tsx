import { ArrowRight, Loader2 } from 'lucide-react';

interface BootstrapCreateAdminFormProps {
  label: string;
  creating: boolean;
  onLabelChange: (nextLabel: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function BootstrapCreateAdminForm({
  label,
  creating,
  onLabelChange,
  onSubmit,
}: BootstrapCreateAdminFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
      <input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Admin label"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={creating}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            Initialize Admin
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
