import { computeTokenStatus, createOpaqueToken, hashOpaqueToken } from '@aws-gaming/auth-links';
import type {
  AdminServerView,
  AdminTokenView,
  SecretAccessToken,
} from '@aws-gaming/contracts';
import type { Repository } from '../db/repository.js';
import type { StatusService } from './status.js';

export class UnknownInstanceIdsError extends Error {
  constructor(readonly unknownIds: string[]) {
    super(`Unknown instance IDs: ${unknownIds.join(', ')}`);
    this.name = 'UnknownInstanceIdsError';
  }
}

export class TokenNotFoundError extends Error {
  constructor() {
    super('Token not found');
    this.name = 'TokenNotFoundError';
  }
}

export type CreateAdminTokenInput = {
  label: string;
  instanceIds: string[];
  expiresAt: string | null;
  isAdmin?: boolean;
};

export type UpdateAdminTokenInput = {
  label?: string;
  instanceIds?: string[];
  expiresAt?: string | null;
  isAdmin?: boolean;
};

function toAdminTokenView(token: SecretAccessToken): AdminTokenView {
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

function findUnknownInstanceIds(instanceIds: string[], knownIds: Set<string>): string[] {
  return instanceIds.filter((id) => !knownIds.has(id));
}

export class AdminService {
  constructor(
    private readonly repo: Repository,
    private readonly statusService: StatusService,
  ) {}

  async listTokenViews(): Promise<AdminTokenView[]> {
    const tokens = await this.repo.listTokens();
    return tokens
      .map((token) => toAdminTokenView(token))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createToken(input: CreateAdminTokenInput): Promise<{ token: AdminTokenView; rawToken: string }> {
    const knownIds = new Set((await this.repo.listInstances()).map((instance) => instance.id));
    const unknownIds = findUnknownInstanceIds(input.instanceIds, knownIds);
    if (unknownIds.length > 0) {
      throw new UnknownInstanceIdsError(unknownIds);
    }

    const rawToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const token: SecretAccessToken = {
      id: `tok_${crypto.randomUUID().slice(0, 8)}`,
      tokenHash,
      label: input.label,
      gameInstanceIds: input.instanceIds,
      expiresAt: input.expiresAt,
      isAdmin: input.isAdmin,
      createdAt: new Date().toISOString(),
    };

    await this.repo.putToken(token);

    return {
      token: toAdminTokenView(token),
      rawToken,
    };
  }

  async updateToken(id: string, input: UpdateAdminTokenInput): Promise<AdminTokenView> {
    const patch: Partial<
      Pick<SecretAccessToken, 'label' | 'gameInstanceIds' | 'expiresAt' | 'isAdmin'>
    > = {};

    if (input.label !== undefined) {
      patch.label = input.label;
    }

    if (input.instanceIds !== undefined) {
      const knownIds = new Set((await this.repo.listInstances()).map((instance) => instance.id));
      const unknownIds = findUnknownInstanceIds(input.instanceIds, knownIds);
      if (unknownIds.length > 0) {
        throw new UnknownInstanceIdsError(unknownIds);
      }
      patch.gameInstanceIds = input.instanceIds;
    }

    if (input.expiresAt !== undefined) {
      patch.expiresAt = input.expiresAt;
    }

    if (input.isAdmin !== undefined) {
      patch.isAdmin = input.isAdmin;
    }

    const token = await this.repo.getTokenById(id);
    if (!token) {
      throw new TokenNotFoundError();
    }

    const updated = await this.repo.updateTokenByHash(token.tokenHash, patch);
    if (!updated) {
      throw new TokenNotFoundError();
    }

    return toAdminTokenView(updated);
  }

  async revokeToken(id: string): Promise<AdminTokenView> {
    const token = await this.repo.getTokenById(id);
    if (!token) {
      throw new TokenNotFoundError();
    }

    const revoked = await this.repo.revokeTokenByHash(
      token.tokenHash,
      new Date().toISOString(),
    );
    if (!revoked) {
      throw new TokenNotFoundError();
    }

    return toAdminTokenView(revoked);
  }

  async listServerViews(): Promise<AdminServerView[]> {
    const instances = await this.repo.listInstances();

    return (await Promise.all(
      instances.map(async (instance) => {
        const server = await this.statusService.buildServerView(instance);
        return {
          id: instance.id,
          displayName: instance.displayName,
          game: instance.gameType,
          gameLabel: instance.gameLabel,
          location: instance.location,
          status: server.status,
          address: server.address,
          maxPlayers: instance.maxPlayers,
        } satisfies AdminServerView;
      }),
    ))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
