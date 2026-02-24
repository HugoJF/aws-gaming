import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UseTokenMutationOptions } from '@/hooks/token-mutations/types';
import { invalidateTokensQuery } from '@/hooks/token-mutations/utils';

export function useRevokeTokenMutation({ token }: UseTokenMutationOptions) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (tokenId: string) => api.adminRevokeToken(token, tokenId),
    onSuccess: () => {
      invalidateTokensQuery(qc, token);
    },
  });
}
