import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerView } from '@aws-gaming/contracts';
import { api, ApiError } from '@/lib/api';

/** Adaptive poll intervals by server status (ms) */
const POLL_INTERVALS: Record<string, number> = {
  online: 15_000,
  offline: 60_000,
  booting: 3_000,
  'shutting-down': 3_000,
  error: 10_000,
};

const DEFAULT_INTERVAL = 15_000;

interface UseServerPollingOptions {
  token: string | null;
  onAuthError?: () => void;
}

export function useServerPolling({ token, onAuthError }: UseServerPollingOptions) {
  const [servers, setServers] = useState<ServerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mountedRef = useRef(true);

  // Initial fetch of all servers
  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.listServers(token);
      if (mountedRef.current) {
        setServers(res.servers);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ApiError && err.status === 401) {
        onAuthError?.();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch servers');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, onAuthError]);

  // Poll a single server's status
  const pollServer = useCallback(
    async (serverId: string) => {
      if (!token || !mountedRef.current) return;
      try {
        const res = await api.getServerStatus(token, serverId);
        if (!mountedRef.current) return;
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? res.server : s)),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onAuthError?.();
        }
        // Silently continue polling on other errors
      }
    },
    [token, onAuthError],
  );

  // Schedule adaptive polling for each server
  useEffect(() => {
    const timers = timersRef.current;

    // Clear old timers
    for (const [, timer] of timers) clearTimeout(timer);
    timers.clear();

    if (!token || servers.length === 0) return;

    for (const server of servers) {
      const interval = POLL_INTERVALS[server.status] ?? DEFAULT_INTERVAL;

      const schedule = () => {
        const timer = setTimeout(async () => {
          await pollServer(server.id);
          if (mountedRef.current) schedule();
        }, interval);
        timers.set(server.id, timer);
      };

      schedule();
    }

    return () => {
      for (const [, timer] of timers) clearTimeout(timer);
      timers.clear();
    };
  }, [token, servers, pollServer]);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Power action that optimistically updates and re-polls
  const togglePower = useCallback(
    async (serverId: string, action: 'on' | 'off') => {
      if (!token) return;
      try {
        const res = await api.powerAction(token, serverId, action);
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? res.server : s)),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onAuthError?.();
        }
        // Re-fetch to get correct state on error
        await pollServer(serverId);
      }
    },
    [token, onAuthError, pollServer],
  );

  return { servers, loading, error, togglePower, refetch: fetchAll };
}
