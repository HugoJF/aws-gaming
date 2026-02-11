import { useState, useMemo } from 'react';

export type AdminView = 'servers' | 'admin';

const ADMIN_TOKEN = 'admin-secret';

export function useAdminMode(token: string | null) {
  const isAdmin = token === ADMIN_TOKEN;
  const [currentView, setCurrentView] = useState<AdminView>('servers');

  return useMemo(
    () => ({
      isAdmin,
      currentView: isAdmin ? currentView : ('servers' as const),
      setCurrentView,
    }),
    [isAdmin, currentView],
  );
}
