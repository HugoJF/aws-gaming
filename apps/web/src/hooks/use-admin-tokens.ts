import { useCallback, useEffect, useState } from 'react';
import type {
  AdminInstanceView,
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
  if (error instanceof ApiError) {
    return error.body.error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function useAdminTokens({ token }: UseAdminTokensOptions) {
  const [tokens, setTokens] = useState<AdminTokenView[]>([]);
  const [instances, setInstances] = useState<AdminInstanceView[]>([]);
  const [lastCreated, setLastCreated] = useState<CreateTokenResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setTokens([]);
      setInstances([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [tokenRes, instanceRes] = await Promise.all([
        api.adminListTokens(token),
        api.adminListInstances(token),
      ]);
      setTokens(tokenRes.tokens);
      setInstances(instanceRes.instances);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateTokenInput) => {
      if (!token) return;

      try {
        const result = await api.adminCreateToken(token, input);
        setTokens((prev) => [result.token, ...prev]);
        setLastCreated({
          token: result.token,
          rawToken: result.rawToken,
          shareUrl: tokenShareUrl(result.rawToken),
        });
        setError(null);
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [token],
  );

  const update = useCallback(
    async (tokenId: string, input: UpdateTokenInput) => {
      if (!token) return;

      try {
        const result = await api.adminUpdateToken(token, tokenId, input);
        setTokens((prev) =>
          prev.map((existing) =>
            existing.id === tokenId ? result.token : existing,
          ),
        );
        setError(null);
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [token],
  );

  const revoke = useCallback(
    async (tokenId: string) => {
      if (!token) return;

      try {
        const result = await api.adminRevokeToken(token, tokenId);
        setTokens((prev) =>
          prev.map((existing) =>
            existing.id === tokenId ? result.token : existing,
          ),
        );
        setError(null);
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [token],
  );

  const dismissCreatedBanner = useCallback(() => {
    setLastCreated(null);
  }, []);

  return {
    tokens,
    instances,
    lastCreated,
    loading,
    error,
    create,
    update,
    revoke,
    dismissCreatedBanner,
    refresh,
  };
}
