import { Hono } from 'hono';
import { createOpaqueToken, hashOpaqueToken } from '@aws-gaming/auth-links';
import type {
  SecretAccessToken,
  AdminListTokensResponse,
  AdminCreateTokenResponse,
  AdminUpdateTokenResponse,
  AdminRevokeTokenResponse,
  AdminListServersResponse,
  AdminListInstancesResponse,
} from '@aws-gaming/contracts';
import type { AppDeps } from '../app-deps.js';
import {
  toAdminTokenView,
  isNonEmptyStringArray,
  normalizeExpiresAt,
  unknownInstanceIds,
} from './token-utils.js';

async function listAdminServers({ repo, statusService }: Pick<AppDeps, 'repo' | 'statusService'>) {
  const instances = await repo.listInstances();

  const views = (await Promise.all(
    instances.map(async (instance) => {
      const server = await statusService.buildServerView(instance);
      return {
        id: instance.id,
        displayName: instance.displayName,
        game: instance.gameType,
        gameLabel: instance.gameLabel,
        location: instance.location,
        status: server.status,
        address: server.address,
        maxPlayers: instance.maxPlayers,
      };
    }),
  ))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return views;
}

export function createAdminRoutes(deps: Pick<AppDeps, 'repo' | 'statusService' | 'adminMiddleware'>) {
  const admin = new Hono();
  admin.use('*', deps.adminMiddleware);

  admin.get('/tokens', async (c) => {
    const tokens = await deps.repo.listTokens();
    const views = tokens
      .map((token) => toAdminTokenView(token))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return c.json({ tokens: views } satisfies AdminListTokensResponse);
  });

  admin.post('/tokens', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'JSON body must be an object' }, 400);
    }
    const input = body as Record<string, unknown>;

    const label =
      typeof input.label === 'string'
        ? input.label.trim()
        : '';
    if (!label) {
      return c.json({ error: 'label is required' }, 400);
    }

    const instanceIds = input.instanceIds;
    if (!isNonEmptyStringArray(instanceIds)) {
      return c.json({ error: 'instanceIds must be a non-empty array of strings' }, 400);
    }

    const expiresAt = normalizeExpiresAt(input.expiresAt);
    if (expiresAt === undefined && input.expiresAt !== undefined) {
      return c.json({ error: 'expiresAt must be an ISO date string or null' }, 400);
    }

    const isAdmin = input.isAdmin;
    if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
      return c.json({ error: 'isAdmin must be boolean when provided' }, 400);
    }

    const knownIds = new Set((await deps.repo.listInstances()).map((instance) => instance.id));
    const unknownIds = unknownInstanceIds(instanceIds, knownIds);
    if (unknownIds.length > 0) {
      return c.json(
        { error: `Unknown instance IDs: ${unknownIds.join(', ')}` },
        400,
      );
    }

    const rawToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const token: SecretAccessToken = {
      id: `tok_${crypto.randomUUID().slice(0, 8)}`,
      tokenHash,
      label,
      gameInstanceIds: instanceIds,
      expiresAt: expiresAt ?? null,
      isAdmin,
      createdAt: new Date().toISOString(),
    };

    await deps.repo.putToken(token);

    return c.json(
      {
        token: toAdminTokenView(token),
        rawToken,
      } satisfies AdminCreateTokenResponse,
      201,
    );
  });

  admin.patch('/tokens/:id', async (c) => {
    const id = c.req.param('id');

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'JSON body must be an object' }, 400);
    }
    const input = body as Record<string, unknown>;

    const patch: Partial<
      Pick<SecretAccessToken, 'label' | 'gameInstanceIds' | 'expiresAt' | 'isAdmin'>
    > = {};

    if ('label' in input) {
      const labelValue = input.label;
      if (typeof labelValue !== 'string' || labelValue.trim().length === 0) {
        return c.json({ error: 'label must be a non-empty string' }, 400);
      }
      patch.label = labelValue.trim();
    }

    if ('instanceIds' in input) {
      const instanceIds = input.instanceIds;
      if (!isNonEmptyStringArray(instanceIds)) {
        return c.json({ error: 'instanceIds must be a non-empty array of strings' }, 400);
      }

      const knownIds = new Set((await deps.repo.listInstances()).map((instance) => instance.id));
      const unknownIds = unknownInstanceIds(instanceIds, knownIds);
      if (unknownIds.length > 0) {
        return c.json(
          { error: `Unknown instance IDs: ${unknownIds.join(', ')}` },
          400,
        );
      }

      patch.gameInstanceIds = instanceIds;
    }

    if ('expiresAt' in input) {
      const expiresAt = normalizeExpiresAt(input.expiresAt);
      if (expiresAt === undefined && input.expiresAt !== undefined) {
        return c.json({ error: 'expiresAt must be an ISO date string or null' }, 400);
      }
      patch.expiresAt = expiresAt ?? null;
    }

    if ('isAdmin' in input) {
      const isAdmin = input.isAdmin;
      if (typeof isAdmin !== 'boolean') {
        return c.json({ error: 'isAdmin must be boolean' }, 400);
      }
      patch.isAdmin = isAdmin;
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ error: 'No mutable fields provided' }, 400);
    }

    const token = await deps.repo.getTokenById(id);
    if (!token) {
      return c.json({ error: 'Token not found' }, 404);
    }

    const updated = await deps.repo.updateTokenByHash(token.tokenHash, patch);
    if (!updated) {
      return c.json({ error: 'Token not found' }, 404);
    }

    return c.json(
      { token: toAdminTokenView(updated) } satisfies AdminUpdateTokenResponse,
    );
  });

  admin.post('/tokens/:id/revoke', async (c) => {
    const id = c.req.param('id');

    const token = await deps.repo.getTokenById(id);
    if (!token) {
      return c.json({ error: 'Token not found' }, 404);
    }

    const revoked = await deps.repo.revokeTokenByHash(
      token.tokenHash,
      new Date().toISOString(),
    );
    if (!revoked) {
      return c.json({ error: 'Token not found' }, 404);
    }

    return c.json(
      { token: toAdminTokenView(revoked) } satisfies AdminRevokeTokenResponse,
    );
  });

  admin.get('/servers', async (c) => {
    return c.json(
      { servers: await listAdminServers(deps) } satisfies AdminListServersResponse,
    );
  });

  // Backward compatibility for older clients.
  admin.get('/instances', async (c) => {
    return c.json(
      { instances: await listAdminServers(deps) } satisfies AdminListInstancesResponse,
    );
  });

  return admin;
}
