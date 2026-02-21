import { computeTokenStatus } from '@aws-gaming/auth-links';
import type { AdminTokenView, SecretAccessToken } from '@aws-gaming/contracts';

export function toAdminTokenView(token: SecretAccessToken): AdminTokenView {
  return {
    id: token.id,
    label: token.label?.trim() || token.id,
    tokenPrefix: token.tokenHash.slice(0, 8),
    status: computeTokenStatus(token.expiresAt, token.revokedAt),
    instanceIds: token.gameInstanceIds,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    isAdmin: token.isAdmin,
  };
}

export function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

export function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function unknownInstanceIds(instanceIds: string[], knownIds: Set<string>): string[] {
  return instanceIds.filter((id) => !knownIds.has(id));
}
