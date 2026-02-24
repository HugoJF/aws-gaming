import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateTokenInput,
  CreateTokenResult,
  UseTokenMutationOptions,
} from '@/hooks/token-mutations/types';
import { tokenShareUrl } from '@/hooks/token-mutations/types';
import { invalidateTokensQuery } from '@/hooks/token-mutations/utils';

export function useCreateTokenMutation({ token }: UseTokenMutationOptions) {
  const qc = useQueryClient();
  const [lastCreated, setLastCreated] = useState<CreateTokenResult | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateTokenInput) => api.adminCreateToken(token, input),
    onSuccess: (result) => {
      setLastCreated({
        token: result.data.token,
        rawToken: result.data.rawToken,
        shareUrl: tokenShareUrl(result.data.rawToken),
      });
      invalidateTokensQuery(qc, token);
    },
  });

  const dismissCreatedBanner = useCallback(() => {
    setLastCreated(null);
  }, []);

  return {
    ...mutation,
    lastCreated,
    dismissCreatedBanner,
  };
}
