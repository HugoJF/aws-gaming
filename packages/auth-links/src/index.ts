import { createHash, randomBytes } from 'node:crypto';

export function createOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isTokenExpired(expiresAtIso: string | null, now = new Date()): boolean {
  if (expiresAtIso === null) {
    return false;
  }
  return new Date(expiresAtIso).getTime() <= now.getTime();
}

export function isTokenRevoked(revokedAtIso?: string): boolean {
  return typeof revokedAtIso === 'string' && revokedAtIso.length > 0;
}

export function computeTokenStatus(
  expiresAtIso: string | null,
  revokedAtIso?: string,
  now = new Date(),
): 'active' | 'revoked' | 'expired' {
  if (isTokenRevoked(revokedAtIso)) {
    return 'revoked';
  }

  if (isTokenExpired(expiresAtIso, now)) {
    return 'expired';
  }

  return 'active';
}
