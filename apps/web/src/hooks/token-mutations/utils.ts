import type { QueryClient } from '@tanstack/react-query';
import { adminTokensQueryKey } from '@/hooks/use-admin-tokens-query';

export function invalidateTokensQuery(
  queryClient: QueryClient,
  token: string,
): void {
  void queryClient.invalidateQueries({ queryKey: adminTokensQueryKey(token) });
}
