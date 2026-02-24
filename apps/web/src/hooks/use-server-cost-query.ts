import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function serverCostQueryKey(
  token: string | null,
  serverId: string,
) {
  return ['server-cost', token, serverId] as const;
}

export function useServerCostQuery(token: string | null, serverId: string) {
  const enabled = Boolean(token) && serverId.length > 0;

  const query = useQuery({
    queryKey: serverCostQueryKey(token, serverId),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: () => api.getServerCost(token!, serverId),
  });

  return {
    estimate: query.data?.data.estimate ?? null,
    loading: enabled && query.isPending,
    error: query.error,
  };
}
