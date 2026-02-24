import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useBootstrapStatusQuery } from '@/hooks/use-bootstrap-status-query';
import { parseTokenInput } from '@/lib/token-input';
import { BootstrapCreateAdminForm } from '@/components/bootstrap-screen/bootstrap-create-admin-form';
import { ManualTokenEntryForm } from '@/components/bootstrap-screen/manual-token-entry-form';

interface BootstrapScreenProps {
  onTokenSubmit: (token: string) => void;
  onBootstrapUnavailable: () => void;
  onBootstrapCompleted: () => void;
  authError?: string | null;
  onDismissAuthError?: () => void;
}

export function BootstrapScreen({
  onTokenSubmit,
  onBootstrapUnavailable,
  onBootstrapCompleted,
  authError,
  onDismissAuthError,
}: BootstrapScreenProps) {
  const [bootstrapLabel, setBootstrapLabel] = useState('Owner');
  const [showManual, setShowManual] = useState(false);
  const [input, setInput] = useState('');

  const statusQuery = useBootstrapStatusQuery();
  const createAdminMutation = useMutation({
    mutationFn: (label?: string) =>
      api.bootstrapCreateAdmin({ label: label?.trim() || undefined }),
    onSuccess: (result) => {
      if (result.status === 409) {
        onBootstrapUnavailable();
        return;
      }
      if (!('rawToken' in result.data)) return;

      onBootstrapCompleted();
      onDismissAuthError?.();
      onTokenSubmit(result.data.rawToken);
    },
  });
  const hasDisplayError =
    Boolean(statusQuery.error) || createAdminMutation.isError;

  useEffect(() => {
    if (statusQuery.canBootstrap === false) {
      onBootstrapUnavailable();
    }
  }, [statusQuery.canBootstrap, onBootstrapUnavailable]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedToken = parseTokenInput(input);
    if (!parsedToken) return;

    onDismissAuthError?.();
    onTokenSubmit(parsedToken);
  };

  const handleBootstrapCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (createAdminMutation.isPending) return;
    createAdminMutation.mutate(bootstrapLabel);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <KeyRound className="h-7 w-7 text-muted-foreground" />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Bootstrap ServerDeck
        </h1>

        {authError && (
          <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{authError}</p>
          </div>
        )}

        {statusQuery.loading ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking setup...
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              No access tokens exist yet. Initialize the first admin token.
            </p>

            <BootstrapCreateAdminForm
              label={bootstrapLabel}
              creating={createAdminMutation.isPending}
              onLabelChange={(nextLabel) => {
                setBootstrapLabel(nextLabel);
                onDismissAuthError?.();
              }}
              onSubmit={handleBootstrapCreate}
            />

            {hasDisplayError && (
              <p className="mt-3 text-xs text-destructive">
                Something went wrong. Please try again.
              </p>
            )}

            <button
              onClick={() => setShowManual((v) => !v)}
              className="mt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showManual
                ? 'Hide manual token entry'
                : 'Have an existing token? Enter manually'}
            </button>

            {showManual && (
              <ManualTokenEntryForm
                input={input}
                onInputChange={(nextInput) => {
                  setInput(nextInput);
                  onDismissAuthError?.();
                }}
                onSubmit={handleManualSubmit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
