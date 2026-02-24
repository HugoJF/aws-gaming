import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function adminServersQueryKey(token: string | null) {
  return ['admin', token, 'servers'] as const;
}

interface UseAdminServersQueryOptions {
  token: string | null;
}

export function useAdminServersQuery({ token }: UseAdminServersQueryOptions) {
  const enabled = Boolean(token);

  const query = useQuery({
    queryKey: adminServersQueryKey(token),
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: () => api.adminListServers(token!),
  });

  return {
    servers: query.data?.data.servers ?? [],
    loading: enabled && query.isPending,
    error: query.error,
  };
}
