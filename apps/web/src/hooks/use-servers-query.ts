import { useQuery } from '@tanstack/react-query';
import type { ServerView } from '@aws-gaming/contracts';
import { api } from '@/lib/api';

const POLL_INTERVALS: Record<string, number> = {
  online: 15_000,
  offline: 60_000,
  booting: 3_000,
  'shutting-down': 3_000,
  error: 10_000,
};

const DEFAULT_INTERVAL = 15_000;

function getRefetchInterval(servers?: ServerView[]): number {
  if (!servers || servers.length === 0) return DEFAULT_INTERVAL;
  return Math.min(
    ...servers.map((server) => POLL_INTERVALS[server.status] ?? DEFAULT_INTERVAL),
  );
}

export function serversQueryKey(token: string | null) {
  return ['servers', token] as const;
}

export function useServersQuery(token: string | null) {
  const enabled = Boolean(token);

  const query = useQuery({
    queryKey: serversQueryKey(token),
    enabled,
    staleTime: 5_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (q) =>
      getRefetchInterval(q.state.data?.data.servers),
    queryFn: () => api.listServers(token!),
  });

  return {
    servers: query.data?.data.servers ?? [],
    loading: enabled && query.isPending,
    error: query.error,
  };
}
