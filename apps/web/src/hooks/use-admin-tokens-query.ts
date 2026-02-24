import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function adminTokensQueryKey(token: string | null) {
  return ['admin', token, 'tokens'] as const;
}

interface UseAdminTokensQueryOptions {
  token: string | null;
}

export function useAdminTokensQuery({ token }: UseAdminTokensQueryOptions) {
  const enabled = Boolean(token);

  const query = useQuery({
    queryKey: adminTokensQueryKey(token),
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: () => api.adminListTokens(token!),
  });

  return {
    tokens: query.data?.data.tokens ?? [],
    loading: enabled && query.isPending,
    error: query.error,
  };
}
