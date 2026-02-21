import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function adminTokensQueryKey(token: string | null) {
  return ['admin', token, 'tokens'] as const;
}

interface UseAdminTokensQueryOptions {
  token: string | null;
}

export function useAdminTokensQuery({ token }: UseAdminTokensQueryOptions) {
  const query = useQuery({
    queryKey: adminTokensQueryKey(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return [];
      const res = await api.adminListTokens(token);
      return res.data.tokens;
    },
  });

  return {
    tokens: query.data ?? [],
    loading: Boolean(token) && query.isPending,
    error: query.error,
  };
}
