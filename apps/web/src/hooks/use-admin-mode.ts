import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export type AdminView = 'servers' | 'admin';

function meQueryKey(token: string | null) {
  return ['me', token] as const;
}

export function useAdminMode(token: string | null) {
  const [currentView, setCurrentView] = useState<AdminView>('servers');

  const meQuery = useQuery({
    queryKey: meQueryKey(token),
    enabled: Boolean(token),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return null;
      try {
        return await api.getMe(token);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          return null;
        }
        throw error;
      }
    },
  });

  const isAdmin = meQuery.data?.isAdmin === true;

  useEffect(() => {
    if (!isAdmin && currentView !== 'servers') {
      setCurrentView('servers');
    }
  }, [isAdmin, currentView]);

  return useMemo(
    () => ({
      isAdmin,
      loading: meQuery.isPending,
      currentView: isAdmin ? currentView : ('servers' as const),
      setCurrentView,
    }),
    [isAdmin, meQuery.isPending, currentView],
  );
}
