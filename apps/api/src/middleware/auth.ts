import type { Context, Next } from 'hono';
import { hashOpaqueToken, isTokenExpired, isTokenRevoked } from '@aws-gaming/auth-links';
import type { Repository } from '../db/repository.js';

export interface AuthContext {
  tokenId: string;
  gameInstanceIds: string[];
  isAdmin: boolean;
}

/**
 * Creates a Hono middleware that validates Bearer tokens via DynamoDB.
 * On success, sets `authContext` on the Hono context variables.
 */
export function createAuthMiddleware(repo: Repository) {
  return async (c: Context, next: Next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const rawToken = header.slice(7);
    if (!rawToken) {
      return c.json({ error: 'Empty bearer token' }, 401);
    }

    const tokenHash = hashOpaqueToken(rawToken);
    const token = await repo.getTokenByHash(tokenHash);

    if (!token) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    if (isTokenExpired(token.expiresAt)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    if (isTokenRevoked(token.revokedAt)) {
      return c.json({ error: 'Token revoked' }, 401);
    }

    c.set('authContext', {
      tokenId: token.id,
      gameInstanceIds: token.gameInstanceIds,
      isAdmin: token.isAdmin === true,
    } satisfies AuthContext);

    await next();
  };
}

/** Helper to get auth context from Hono context */
export function getAuthContext(c: Context): AuthContext {
  return c.get('authContext') as AuthContext;
}

/**
 * Creates a middleware that allows only admin tokens through.
 * Must run after auth middleware has set authContext.
 */
export function createAdminMiddleware() {
  return async (c: Context, next: Next) => {
    const auth = getAuthContext(c);
    if (!auth.isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    await next();
  };
}
