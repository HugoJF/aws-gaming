import { useQuery } from '@tanstack/react-query';
import type { ServerHourlyCostEstimate } from '@aws-gaming/contracts';
import { api } from '@/lib/api';

export function serverCostQueryKey(
  token: string | null,
  serverId: string,
) {
  return ['server-cost', token, serverId] as const;
}

export function useServerCostQuery(token: string | null, serverId: string) {
  const query = useQuery({
    queryKey: serverCostQueryKey(token, serverId),
    enabled: Boolean(token) && serverId.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!token) throw new Error('Missing auth token');
      const res = await api.getServerCost(token, serverId);
      return res.estimate as ServerHourlyCostEstimate;
    },
  });

  return {
    estimate: query.data ?? null,
    loading: query.isPending,
    error: query.error,
  };
}

