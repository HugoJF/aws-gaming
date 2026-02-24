import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  UpdateTokenMutationVars,
  UseTokenMutationOptions,
} from '@/hooks/token-mutations/types';
import { invalidateTokensQuery } from '@/hooks/token-mutations/utils';

export function useUpdateTokenMutation({ token }: UseTokenMutationOptions) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ tokenId, input }: UpdateTokenMutationVars) =>
      api.adminUpdateToken(token, tokenId, input),
    onSuccess: () => {
      invalidateTokensQuery(qc, token);
    },
  });
}
