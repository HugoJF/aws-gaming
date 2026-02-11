import { useEffect, useState } from 'react';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface UnauthedScreenProps {
  onTokenSubmit: (token: string) => void;
  authError?: string | null;
  onDismissAuthError?: () => void;
}

export function UnauthedScreen({
  onTokenSubmit,
  authError,
  onDismissAuthError,
}: UnauthedScreenProps) {
  const [input, setInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [bootstrapLabel, setBootstrapLabel] = useState('Owner');
  const [bootstrapCreating, setBootstrapCreating] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrapStatus() {
      try {
        const response = await api.bootstrapStatus();
        if (!cancelled) {
          setCanBootstrap(response.canBootstrap);
        }
      } catch {
        if (!cancelled) {
          setCanBootstrap(false);
        }
      } finally {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      }
    }

    void loadBootstrapStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    const match = trimmed.match(/\/t\/(.+)$/);
    onDismissAuthError?.();
    onTokenSubmit(match ? match[1] : trimmed);
  };

  const handleBootstrapCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bootstrapCreating) return;

    setBootstrapCreating(true);
    setBootstrapError(null);

    try {
      const result = await api.bootstrapCreateAdmin({
        label: bootstrapLabel.trim() || undefined,
      });
      onDismissAuthError?.();
      onTokenSubmit(result.rawToken);
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : 'Failed to initialize admin',
      );
      setBootstrapLoading(true);
      try {
        const response = await api.bootstrapStatus();
        setCanBootstrap(response.canBootstrap);
      } catch {
        setCanBootstrap(false);
      } finally {
        setBootstrapLoading(false);
      }
    } finally {
      setBootstrapCreating(false);
    }
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

        {authError && (
          <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{authError}</p>
          </div>
        )}

        {bootstrapLoading ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking setup...
          </div>
        ) : canBootstrap ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              No access tokens exist yet. Initialize the first admin token.
            </p>

            <form onSubmit={handleBootstrapCreate} className="mt-5 flex flex-col gap-3">
              <input
                type="text"
                value={bootstrapLabel}
                onChange={(e) => {
                  setBootstrapLabel(e.target.value);
                  onDismissAuthError?.();
                }}
                placeholder="Admin label"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={bootstrapCreating}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bootstrapCreating ? (
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
              {bootstrapError && (
                <p className="text-xs text-destructive">{bootstrapError}</p>
              )}
            </form>

            <button
              onClick={() => setShowManual((v) => !v)}
              className="mt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showManual ? 'Hide manual token entry' : 'Have an existing token? Enter manually'}
            </button>

            {showManual && (
              <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    onDismissAuthError?.();
                  }}
                  placeholder="Paste token or access link"
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
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              You need an access link to view your game servers. Ask your admin for one.
            </p>

            <div className="mt-8">
              {showManual ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      onDismissAuthError?.();
                    }}
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
          </>
        )}
      </div>
    </div>
  );
}
