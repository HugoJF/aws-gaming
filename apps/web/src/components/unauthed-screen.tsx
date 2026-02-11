import { useState } from 'react';
import { KeyRound, ArrowRight } from 'lucide-react';

interface UnauthedScreenProps {
  onTokenSubmit: (token: string) => void;
}

export function UnauthedScreen({ onTokenSubmit }: UnauthedScreenProps) {
  const [input, setInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    // Accept both raw tokens and full URLs like https://host/t/abc123
    const match = trimmed.match(/\/t\/(.+)$/);
    onTokenSubmit(match ? match[1] : trimmed);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <KeyRound className="h-7 w-7 text-muted-foreground" />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-foreground">
          ServerDeck
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need an access link to view your game servers. Ask your admin for
          one.
        </p>

        <div className="mt-8">
          {showManual ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste token or access link"
                autoFocus
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={input.trim().length === 0}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowManual(true)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Have a token? Enter it manually
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
