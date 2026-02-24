import { Hono } from 'hono';
import type {
  AdminListTokensResponse,
  AdminCreateTokenResponse,
  AdminUpdateTokenResponse,
  AdminRevokeTokenResponse,
  AdminListServersResponse,
  AdminListInstancesResponse,
} from '@aws-gaming/contracts';
import type { AppDeps } from '../app-deps.js';
import { TokenNotFoundError, UnknownInstanceIdsError } from '../services/admin.js';
import { jsonZodValidator } from '../utils/zod-validator.js';
import { createTokenBodySchema, updateTokenBodySchema } from './admin.schemas.js';

type AdminEnv = {
  Variables: {
    adminService: AppDeps['adminService'];
  };
};

export const adminRoutes = new Hono<AdminEnv>();

adminRoutes.get('/tokens', async (c) => {
  const adminService = c.get('adminService');
  return c.json({
    tokens: await adminService.listTokenViews(),
  } satisfies AdminListTokensResponse);
});

adminRoutes.post(
  '/tokens',
  jsonZodValidator(createTokenBodySchema, { invalidBodyMessage: 'JSON body must be an object' }),
  async (c) => {
    const adminService = c.get('adminService');
    const input = c.req.valid('json');

    try {
      const created = await adminService.createToken({
        label: input.label,
        instanceIds: input.instanceIds,
        expiresAt: input.expiresAt ?? null,
        isAdmin: input.isAdmin,
      });

      return c.json(
        {
          token: created.token,
          rawToken: created.rawToken,
        } satisfies AdminCreateTokenResponse,
        201,
      );
    } catch (error) {
      if (error instanceof UnknownInstanceIdsError) {
        return c.json(
          { error: `Unknown instance IDs: ${error.unknownIds.join(', ')}` },
          400,
        );
      }
      throw error;
    }
  },
);

adminRoutes.patch(
  '/tokens/:id',
  jsonZodValidator(updateTokenBodySchema, { invalidBodyMessage: 'JSON body must be an object' }),
  async (c) => {
    const adminService = c.get('adminService');
    const id = c.req.param('id');
    const input = c.req.valid('json');

    try {
      const token = await adminService.updateToken(id, {
        label: input.label,
        instanceIds: input.instanceIds,
        expiresAt: input.expiresAt,
        isAdmin: input.isAdmin,
      });

      return c.json(
        { token } satisfies AdminUpdateTokenResponse,
      );
    } catch (error) {
      if (error instanceof UnknownInstanceIdsError) {
        return c.json(
          { error: `Unknown instance IDs: ${error.unknownIds.join(', ')}` },
          400,
        );
      }
      if (error instanceof TokenNotFoundError) {
        return c.json({ error: 'Token not found' }, 404);
      }
      throw error;
    }
  },
);

adminRoutes.post('/tokens/:id/revoke', async (c) => {
  const adminService = c.get('adminService');
  const id = c.req.param('id');

  try {
    const token = await adminService.revokeToken(id);
    return c.json(
      { token } satisfies AdminRevokeTokenResponse,
    );
  } catch (error) {
    if (error instanceof TokenNotFoundError) {
      return c.json({ error: 'Token not found' }, 404);
    }
    throw error;
  }
});

adminRoutes.get('/servers', async (c) => {
  const adminService = c.get('adminService');
  return c.json(
    { servers: await adminService.listServerViews() } satisfies AdminListServersResponse,
  );
});

// Backward compatibility for older clients.
adminRoutes.get('/instances', async (c) => {
  const adminService = c.get('adminService');
  return c.json(
    { instances: await adminService.listServerViews() } satisfies AdminListInstancesResponse,
  );
});
