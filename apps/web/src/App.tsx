import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useServerPolling } from '@/hooks/use-server-polling';
import { useAdminMode } from '@/hooks/use-admin-mode';
import { DashboardHeader } from '@/components/dashboard-header';
import { EmptyState } from '@/components/empty-state';
import { UnauthedScreen } from '@/components/unauthed-screen';
import { BootstrapScreen } from '@/components/bootstrap-screen';
import { ServerCard } from '@/components/server-card';
import { AdminView } from '@/components/admin/admin-view';
import { Loader2 } from 'lucide-react';

const BOOTSTRAP_DONE_KEY = 'serverdeck_bootstrap_not_needed';
const NAV_EVENT = 'serverdeck:navigate';

export function App() {
  const { token, isAuthenticated, login, logout } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [pathVersion, setPathVersion] = useState(0);
  const [skipBootstrapCheck, setSkipBootstrapCheck] = useState(() =>
    localStorage.getItem(BOOTSTRAP_DONE_KEY) === '1',
  );
  const { isAdmin, currentView, setCurrentView } = useAdminMode(token);
  const pathname = window.location.pathname;
  const isBootstrapRoute = pathname === '/bootstrap';

  const handleAuthError = useCallback((message?: string) => {
    setAuthError(message ?? 'Session expired. Please enter your access token again.');
    logout();
  }, [logout]);

  const handleTokenSubmit = useCallback((nextToken: string) => {
    setAuthError(null);
    login(nextToken);
  }, [login]);

  const replacePath = useCallback((nextPath: string) => {
    if (window.location.pathname === nextPath) return;
    window.history.replaceState(null, '', nextPath);
    window.dispatchEvent(new Event(NAV_EVENT));
  }, []);

  const markBootstrapAsComplete = useCallback(() => {
    localStorage.setItem(BOOTSTRAP_DONE_KEY, '1');
    setSkipBootstrapCheck(true);
  }, []);

  useEffect(() => {
    const rerenderForPathChange = () => setPathVersion((v) => v + 1);
    window.addEventListener('popstate', rerenderForPathChange);
    window.addEventListener(NAV_EVENT, rerenderForPathChange);
    return () => {
      window.removeEventListener('popstate', rerenderForPathChange);
      window.removeEventListener(NAV_EVENT, rerenderForPathChange);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    if (!skipBootstrapCheck && pathname === '/') {
      replacePath('/bootstrap');
      return;
    }
    if (skipBootstrapCheck && isBootstrapRoute) {
      replacePath('/');
    }
  }, [isAuthenticated, isBootstrapRoute, pathname, replacePath, skipBootstrapCheck]);

  void pathVersion;

  const { servers, loading, error, togglePower } = useServerPolling({
    token,
    onAuthError: handleAuthError,
  });

  if (!isAuthenticated) {
    if (!skipBootstrapCheck && pathname === '/') {
      return null;
    }
    if (isBootstrapRoute && !skipBootstrapCheck) {
      return (
        <BootstrapScreen
          onTokenSubmit={handleTokenSubmit}
          onBootstrapCompleted={markBootstrapAsComplete}
          onBootstrapUnavailable={() => {
            markBootstrapAsComplete();
            replacePath('/');
          }}
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
                  server={server}
                  onTogglePower={togglePower}
                />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
