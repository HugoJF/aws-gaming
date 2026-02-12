import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  onAuthError?: (message?: string) => void;
}

function isAuthError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.body.error;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

function queryKey(token: string | null) {
  return ['servers', token] as const;
}

function getRefetchInterval(servers?: ServerView[]): number {
  if (!servers || servers.length === 0) return DEFAULT_INTERVAL;
  return Math.min(
    ...servers.map((server) => POLL_INTERVALS[server.status] ?? DEFAULT_INTERVAL),
  );
}

export function useServerPolling({ token, onAuthError }: UseServerPollingOptions) {
  const qc = useQueryClient();

  const serversQuery = useQuery({
    queryKey: queryKey(token),
    enabled: Boolean(token),
    staleTime: 5_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      getRefetchInterval(query.state.data as ServerView[] | undefined),
    queryFn: async () => {
      if (!token) return [];
      try {
        const res = await api.listServers(token);
        return res.servers;
      } catch (error) {
        if (isAuthError(error)) onAuthError?.(error.body.error);
        throw error;
      }
    },
  });

  const powerMutation = useMutation({
    mutationFn: async ({ serverId, action }: { serverId: string; action: 'on' | 'off' }) => {
      if (!token) throw new Error('Missing auth token');
      return api.powerAction(token, serverId, action);
    },
    onSuccess: (res, variables) => {
      qc.setQueryData<ServerView[]>(
        queryKey(token),
        (prev) =>
          prev?.map((server) =>
            server.id === variables.serverId ? res.server : server,
          ) ?? prev,
      );
      void qc.invalidateQueries({ queryKey: queryKey(token) });
    },
    onError: (error) => {
      if (isAuthError(error)) onAuthError?.(error.body.error);
    },
  });

  const togglePower = useCallback(
    async (serverId: string, action: 'on' | 'off') => {
      if (!token) return;
      await powerMutation.mutateAsync({ serverId, action });
    },
    [token, powerMutation],
  );

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKey(token) });
  }, [qc, token]);

  const error = serversQuery.error
    ? toErrorMessage(serversQuery.error)
    : powerMutation.error
      ? toErrorMessage(powerMutation.error)
      : null;

  return {
    servers: serversQuery.data ?? [],
    loading: serversQuery.isPending,
    error,
    togglePower,
    refetch,
  };
}
