import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function meQueryKey(token: string | null) {
  return ['me', token] as const;
}

export function useAdminMode(token: string | null) {
  const enabled = Boolean(token);

  const meQuery = useQuery({
    queryKey: meQueryKey(token),
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: () => api.getMe(token!),
  });

  return {
    isAdmin: meQuery.data?.data.isAdmin === true,
    loading: enabled && meQuery.isPending,
  };
}
