import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AdminTokenView,
  AdminCreateTokenRequest,
  AdminUpdateTokenRequest,
} from '@aws-gaming/contracts';
import { api } from '@/lib/api';
import { adminTokensQueryKey } from './use-admin-tokens-query';

export interface CreateTokenInput extends AdminCreateTokenRequest {}

export interface UpdateTokenInput extends AdminUpdateTokenRequest {}

export interface CreateTokenResult {
  token: AdminTokenView;
  rawToken: string;
  shareUrl: string;
}

export function tokenShareUrl(rawToken: string): string {
  return `/t/${rawToken}`;
}

interface UseTokenMutationsOptions {
  token: string | null;
}

export function useTokenMutations({ token }: UseTokenMutationsOptions) {
  const qc = useQueryClient();
  const [lastCreated, setLastCreated] = useState<CreateTokenResult | null>(null);

  const createMutation = useMutation({
    mutationFn: async (input: CreateTokenInput) => {
      if (!token) throw new Error('Missing auth token');
      return api.adminCreateToken(token, input);
    },
    onSuccess: (result) => {
      setLastCreated({
        token: result.token,
        rawToken: result.rawToken,
        shareUrl: tokenShareUrl(result.rawToken),
      });
      void qc.invalidateQueries({ queryKey: adminTokensQueryKey(token) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      tokenId,
      input,
    }: {
      tokenId: string;
      input: UpdateTokenInput;
    }) => {
      if (!token) throw new Error('Missing auth token');
      return api.adminUpdateToken(token, tokenId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminTokensQueryKey(token) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!token) throw new Error('Missing auth token');
      return api.adminRevokeToken(token, tokenId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminTokensQueryKey(token) });
    },
  });

  const create = useCallback(
    async (input: CreateTokenInput) => {
      if (!token) return;
      await createMutation.mutateAsync(input);
    },
    [token, createMutation],
  );

  const update = useCallback(
    async (tokenId: string, input: UpdateTokenInput) => {
      if (!token) return;
      await updateMutation.mutateAsync({ tokenId, input });
    },
    [token, updateMutation],
  );

  const revoke = useCallback(
    async (tokenId: string) => {
      if (!token) return;
      await revokeMutation.mutateAsync(tokenId);
    },
    [token, revokeMutation],
  );

  const dismissCreatedBanner = useCallback(() => {
    setLastCreated(null);
  }, []);

  return {
    lastCreated,
    error: createMutation.error ?? updateMutation.error ?? revokeMutation.error,
    create,
    update,
    revoke,
    dismissCreatedBanner,
  };
}
