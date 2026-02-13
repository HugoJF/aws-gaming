import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useServersQuery } from '@/hooks/use-servers-query';
import { usePowerMutation } from '@/hooks/use-power-mutation';
import { useAdminMode } from '@/hooks/use-admin-mode';
import { DashboardHeader } from '@/components/dashboard-header';
import { EmptyState } from '@/components/empty-state';
import { UnauthedScreen } from '@/components/unauthed-screen';
import { BootstrapScreen } from '@/components/bootstrap-screen';
import { ServerCard } from '@/components/server-card';
import { AdminView } from '@/components/admin/admin-view';
import { ApiError } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const BOOTSTRAP_DONE_KEY = 'serverdeck_bootstrap_not_needed';

export function App() {
  const { token, isAuthenticated, login, logout } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [skipBootstrapCheck, setSkipBootstrapCheck] = useState(() =>
    localStorage.getItem(BOOTSTRAP_DONE_KEY) === '1',
  );
  const { isAdmin } = useAdminMode(token);
  const [currentView, setCurrentView] = useState<'servers' | 'admin'>('servers');
  const showBootstrap = !isAuthenticated && !skipBootstrapCheck;

  const handleAuthError = useCallback((message?: string) => {
    setAuthError(message ?? 'Session expired. Please enter your access token again.');
    logout();
  }, [logout]);

  const handleTokenSubmit = useCallback((nextToken: string) => {
    setAuthError(null);
    login(nextToken);
  }, [login]);

  const markBootstrapAsComplete = useCallback(() => {
    localStorage.setItem(BOOTSTRAP_DONE_KEY, '1');
    setSkipBootstrapCheck(true);
  }, []);

  useEffect(() => {
    const path = showBootstrap ? '/bootstrap' : '/';
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
  }, [showBootstrap]);

  const { servers, loading, error: queryError } = useServersQuery(token);
  const { togglePower, pendingServerId, error: mutationError } = usePowerMutation(token);

  const errorSource = queryError ?? mutationError;
  const isAuthError =
    errorSource instanceof ApiError &&
    (errorSource.status === 401 || errorSource.status === 403);

  useEffect(() => {
    if (isAuthError) handleAuthError((errorSource as ApiError).body.error);
  }, [isAuthError, errorSource, handleAuthError]);

  const error =
    errorSource && !isAuthError
      ? errorSource instanceof ApiError
        ? errorSource.body.error
        : errorSource.message
      : null;

  if (!isAuthenticated) {
    if (showBootstrap) {
      return (
        <BootstrapScreen
          onTokenSubmit={handleTokenSubmit}
          onBootstrapCompleted={markBootstrapAsComplete}
          onBootstrapUnavailable={markBootstrapAsComplete}
          authError={authError}
          onDismissAuthError={() => setAuthError(null)}
        />
      );
    }
    return (
      <UnauthedScreen
        onTokenSubmit={handleTokenSubmit}
        authError={authError}
        onDismissAuthError={() => setAuthError(null)}
      />
    );
  }

  const onlineCount = servers.filter(
    (s) => s.status === 'online' || s.status === 'booting',
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        serverCount={servers.length}
        onlineCount={onlineCount}
        isAdmin={isAdmin}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {currentView === 'admin' ? (
        <AdminView token={token} />
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Your Servers
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your game servers in one place
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Loading servers...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 py-12 px-6 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          ) : servers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-4">
              {servers.map((server) => (
                <ServerCard
                  key={server.id}
                  token={token}
                  server={server}
                  onTogglePower={togglePower}
                  powerPending={pendingServerId === server.id}
                />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
