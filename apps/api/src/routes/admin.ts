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
import { jsonZodValidator } from '../utils/zod-validator.js';
import { createTokenBodySchema, updateTokenBodySchema } from './admin.schemas.js';
import {
  toAdminTokenView,
  unknownInstanceIds,
} from './token-utils.js';

type AdminEnv = {
  Variables: {
    repo: AppDeps['repo'];
    statusService: AppDeps['statusService'];
  };
};

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

export const adminRoutes = new Hono<AdminEnv>();

adminRoutes.get('/tokens', async (c) => {
  const repo = c.get('repo');
  const tokens = await repo.listTokens();
  const views = tokens
    .map((token) => toAdminTokenView(token))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ tokens: views } satisfies AdminListTokensResponse);
});

adminRoutes.post(
  '/tokens',
  jsonZodValidator(createTokenBodySchema, { invalidBodyMessage: 'JSON body must be an object' }),
  async (c) => {
    const repo = c.get('repo');
    const input = c.req.valid('json');

    const knownIds = new Set((await repo.listInstances()).map((instance) => instance.id));
    const unknownIds = unknownInstanceIds(input.instanceIds, knownIds);
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
      label: input.label,
      gameInstanceIds: input.instanceIds,
      expiresAt: input.expiresAt ?? null,
      isAdmin: input.isAdmin,
      createdAt: new Date().toISOString(),
    };

    await repo.putToken(token);

    return c.json(
      {
        token: toAdminTokenView(token),
        rawToken,
      } satisfies AdminCreateTokenResponse,
      201,
    );
  },
);

adminRoutes.patch(
  '/tokens/:id',
  jsonZodValidator(updateTokenBodySchema, { invalidBodyMessage: 'JSON body must be an object' }),
  async (c) => {
    const repo = c.get('repo');
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const patch: Partial<
      Pick<SecretAccessToken, 'label' | 'gameInstanceIds' | 'expiresAt' | 'isAdmin'>
    > = {};

    if (input.label !== undefined) {
      patch.label = input.label;
    }

    if (input.instanceIds !== undefined) {
      const knownIds = new Set((await repo.listInstances()).map((instance) => instance.id));
      const unknownIds = unknownInstanceIds(input.instanceIds, knownIds);
      if (unknownIds.length > 0) {
        return c.json(
          { error: `Unknown instance IDs: ${unknownIds.join(', ')}` },
          400,
        );
      }
      patch.gameInstanceIds = input.instanceIds;
    }

    if (input.expiresAt !== undefined) {
      patch.expiresAt = input.expiresAt;
    }

    if (input.isAdmin !== undefined) {
      patch.isAdmin = input.isAdmin;
    }

    const token = await repo.getTokenById(id);
    if (!token) {
      return c.json({ error: 'Token not found' }, 404);
    }

    const updated = await repo.updateTokenByHash(token.tokenHash, patch);
    if (!updated) {
      return c.json({ error: 'Token not found' }, 404);
    }

    return c.json(
      { token: toAdminTokenView(updated) } satisfies AdminUpdateTokenResponse,
    );
  },
);

adminRoutes.post('/tokens/:id/revoke', async (c) => {
  const repo = c.get('repo');
  const id = c.req.param('id');

  const token = await repo.getTokenById(id);
  if (!token) {
    return c.json({ error: 'Token not found' }, 404);
  }

  const revoked = await repo.revokeTokenByHash(
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

adminRoutes.get('/servers', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  return c.json(
    { servers: await listAdminServers({ repo, statusService }) } satisfies AdminListServersResponse,
  );
});

// Backward compatibility for older clients.
adminRoutes.get('/instances', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  return c.json(
    { instances: await listAdminServers({ repo, statusService }) } satisfies AdminListInstancesResponse,
  );
});
