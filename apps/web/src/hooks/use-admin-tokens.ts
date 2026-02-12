import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminTokenView,
  AdminCreateTokenRequest,
  AdminUpdateTokenRequest,
} from '@aws-gaming/contracts';
import { api, ApiError } from '@/lib/api';

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

interface UseAdminTokensOptions {
  token: string | null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.body.error;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

function tokenQueryKey(token: string | null) {
  return ['admin', token, 'tokens'] as const;
}

function serverQueryKey(token: string | null) {
  return ['admin', token, 'servers'] as const;
}

export function useAdminTokens({ token }: UseAdminTokensOptions) {
  const qc = useQueryClient();
  const [lastCreated, setLastCreated] = useState<CreateTokenResult | null>(null);

  const tokensQuery = useQuery({
    queryKey: tokenQueryKey(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return [];
      const res = await api.adminListTokens(token);
      return res.tokens;
    },
  });

  const serversQuery = useQuery({
    queryKey: serverQueryKey(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      if (!token) return [];
      const res = await api.adminListServers(token);
      return res.servers;
    },
  });

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
      void qc.invalidateQueries({ queryKey: tokenQueryKey(token) });
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
      void qc.invalidateQueries({ queryKey: tokenQueryKey(token) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!token) throw new Error('Missing auth token');
      return api.adminRevokeToken(token, tokenId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tokenQueryKey(token) });
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

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: tokenQueryKey(token) }),
      qc.invalidateQueries({ queryKey: serverQueryKey(token) }),
    ]);
  }, [qc, token]);

  const errorSource =
    tokensQuery.error ??
    serversQuery.error ??
    createMutation.error ??
    updateMutation.error ??
    revokeMutation.error;

  return {
    tokens: tokensQuery.data ?? [],
    instances: serversQuery.data ?? [],
    lastCreated,
    loading:
      Boolean(token) &&
      (tokensQuery.isPending || serversQuery.isPending),
    error: errorSource ? toErrorMessage(errorSource) : null,
    create,
    update,
    revoke,
    dismissCreatedBanner,
    refresh,
  };
}
