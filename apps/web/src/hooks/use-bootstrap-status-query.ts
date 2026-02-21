import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function bootstrapStatusQueryKey() {
  return ['bootstrap', 'status'] as const;
}

export function useBootstrapStatusQuery() {
  const query = useQuery({
    queryKey: bootstrapStatusQueryKey(),
    queryFn: () => api.bootstrapStatus(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  return {
    canBootstrap: query.data?.data.canBootstrap,
    loading: query.isPending,
    error: query.error,
  };
}
