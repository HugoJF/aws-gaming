import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function adminServersQueryKey(token: string | null) {
  return ['admin', token, 'servers'] as const;
}

interface UseAdminServersQueryOptions {
  token: string | null;
}

export function useAdminServersQuery({ token }: UseAdminServersQueryOptions) {
  const query = useQuery({
    queryKey: adminServersQueryKey(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return [];
      const res = await api.adminListServers(token);
      return res.data.servers;
    },
  });

  return {
    servers: query.data ?? [],
    loading: Boolean(token) && query.isPending,
    error: query.error,
  };
}
