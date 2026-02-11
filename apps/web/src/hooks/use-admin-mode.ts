import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';

export type AdminView = 'servers' | 'admin';

export function useAdminMode(token: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<AdminView>('servers');

  useEffect(() => {
    let cancelled = false;

    async function resolveAdminMode() {
      if (!token) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const me = await api.getMe(token);
        if (!cancelled) {
          setIsAdmin(me.isAdmin === true);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            setIsAdmin(false);
          } else {
            setIsAdmin(false);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resolveAdminMode();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!isAdmin && currentView !== 'servers') {
      setCurrentView('servers');
    }
  }, [isAdmin, currentView]);

  return useMemo(
    () => ({
      isAdmin,
      loading,
      currentView: isAdmin ? currentView : ('servers' as const),
      setCurrentView,
    }),
    [isAdmin, loading, currentView],
  );
}
