import { useQuery } from '@tanstack/react-query';
import { api, getHttpStatus } from '@/lib/api';

function meQueryKey(token: string | null) {
  return ['me', token] as const;
}

export function useAdminMode(token: string | null) {
  const meQuery = useQuery({
    queryKey: meQueryKey(token),
    enabled: Boolean(token),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return null;
      try {
        return (await api.getMe(token)).data;
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 401 || status === 403) {
          return null;
        }
        throw error;
      }
    },
  });

  return {
    isAdmin: meQuery.data?.isAdmin === true,
    loading: meQuery.isPending,
  };
}
