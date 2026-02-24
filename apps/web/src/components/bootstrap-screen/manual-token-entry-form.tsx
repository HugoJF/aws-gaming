import { ArrowRight } from 'lucide-react';
import { parseTokenInput } from '@/lib/token-input';

interface ManualTokenEntryFormProps {
  input: string;
  onInputChange: (nextInput: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ManualTokenEntryForm({
  input,
  onInputChange,
  onSubmit,
}: ManualTokenEntryFormProps) {
  const parsedToken = parseTokenInput(input);

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Paste token or access link"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={parsedToken === null}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
