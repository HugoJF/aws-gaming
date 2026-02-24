import type { AdminTokenView } from '@aws-gaming/contracts';
import type { Repository } from '../db/repository.js';
import type { AdminService } from './admin.js';

export class BootstrapAlreadyCompletedError extends Error {
  constructor() {
    super('Bootstrap already completed');
    this.name = 'BootstrapAlreadyCompletedError';
  }
}

export class BootstrapService {
  constructor(
    private readonly repo: Repository,
    private readonly adminService: AdminService,
  ) {}

  async canBootstrapAdmin(): Promise<boolean> {
    const tokens = await this.repo.listTokens();
    return tokens.length === 0;
  }

  async createInitialAdmin(label: string): Promise<{ token: AdminTokenView; rawToken: string }> {
    if (!(await this.canBootstrapAdmin())) {
      throw new BootstrapAlreadyCompletedError();
    }

    const instanceIds = (await this.repo.listInstances()).map((instance) => instance.id);
    return this.adminService.createToken({
      label,
      instanceIds,
      expiresAt: null,
      isAdmin: true,
    });
  }
}
