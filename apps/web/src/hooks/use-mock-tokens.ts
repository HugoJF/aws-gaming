import { useCallback, useState } from 'react';
import {
  MOCK_TOKENS,
  MOCK_INSTANCES,
  type AdminTokenView,
} from '@/lib/mock-admin-data';

let nextId = MOCK_TOKENS.length + 1;

function generateTokenPrefix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `sk_${suffix}`;
}

export function tokenShareUrl(token: AdminTokenView): string {
  return `/t/${token.tokenPrefix}_mock_${token.id}`;
}

export interface CreateTokenInput {
  label: string;
  instanceIds: string[];
  expiryDays: number | null; // null = never expires
}

export interface UpdateTokenInput {
  label: string;
  instanceIds: string[];
}

export interface CreateTokenResult {
  token: AdminTokenView;
  shareUrl: string;
}

export function useMockTokens() {
  const [tokens, setTokens] = useState<AdminTokenView[]>(MOCK_TOKENS);
  const [lastCreated, setLastCreated] = useState<CreateTokenResult | null>(
    null,
  );

  const create = useCallback((input: CreateTokenInput) => {
    const now = new Date();
    let expiresAt: string | null = null;
    if (input.expiryDays !== null) {
      const expires = new Date(now);
      expires.setDate(expires.getDate() + input.expiryDays);
      expiresAt = expires.toISOString();
    }

    const prefix = generateTokenPrefix();
    const newToken: AdminTokenView = {
      id: `tok_${String(++nextId).padStart(3, '0')}`,
      label: input.label,
      tokenPrefix: prefix,
      status: 'active',
      instanceIds: input.instanceIds,
      createdAt: now.toISOString(),
      expiresAt,
    };

    const shareUrl = tokenShareUrl(newToken);

    setTokens((prev) => [newToken, ...prev]);
    setLastCreated({ token: newToken, shareUrl });

    return { token: newToken, shareUrl };
  }, []);

  const update = useCallback((tokenId: string, input: UpdateTokenInput) => {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === tokenId
          ? { ...t, label: input.label, instanceIds: input.instanceIds }
          : t,
      ),
    );
  }, []);

  const revoke = useCallback((tokenId: string) => {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === tokenId
          ? { ...t, status: 'revoked' as const, revokedAt: new Date().toISOString() }
          : t,
      ),
    );
  }, []);

  const dismissCreatedBanner = useCallback(() => {
    setLastCreated(null);
  }, []);

  return {
    tokens,
    instances: MOCK_INSTANCES,
    lastCreated,
    create,
    update,
    revoke,
    dismissCreatedBanner,
  };
}
