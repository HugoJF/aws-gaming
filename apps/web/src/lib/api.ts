import type {
  ListServersResponse,
  ServerStatusResponse,
  PowerResponse,
  ErrorResponse,
  MeResponse,
  AdminListTokensResponse,
  AdminCreateTokenRequest,
  AdminCreateTokenResponse,
  AdminUpdateTokenRequest,
  AdminUpdateTokenResponse,
  AdminRevokeTokenResponse,
  AdminListServersResponse,
  AdminListInstancesResponse,
  BootstrapStatusResponse,
  BootstrapCreateAdminRequest,
  BootstrapCreateAdminResponse,
} from '@aws-gaming/contracts';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

class ApiError extends Error {
  constructor(
    public status: number,
    public body: ErrorResponse,
  ) {
    super(body.error);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: `HTTP ${res.status}`,
    }))) as ErrorResponse;
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

async function requestPublic<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: `HTTP ${res.status}`,
    }))) as ErrorResponse;
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export const api = {
  listServers(token: string) {
    return request<ListServersResponse>('/api/servers', token);
  },

  getServerStatus(token: string, serverId: string) {
    return request<ServerStatusResponse>(
      `/api/servers/${serverId}/status`,
      token,
    );
  },

  powerAction(token: string, serverId: string, action: 'on' | 'off') {
    return request<PowerResponse>(`/api/servers/${serverId}/power`, token, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  getMe(token: string) {
    return request<MeResponse>('/api/me', token);
  },

  adminListTokens(token: string) {
    return request<AdminListTokensResponse>('/api/admin/tokens', token);
  },

  adminCreateToken(token: string, input: AdminCreateTokenRequest) {
    return request<AdminCreateTokenResponse>('/api/admin/tokens', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  adminUpdateToken(token: string, id: string, input: AdminUpdateTokenRequest) {
    return request<AdminUpdateTokenResponse>(`/api/admin/tokens/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  adminRevokeToken(token: string, id: string) {
    return request<AdminRevokeTokenResponse>(`/api/admin/tokens/${id}/revoke`, token, {
      method: 'POST',
    });
  },

  adminListServers(token: string) {
    return request<AdminListServersResponse>('/api/admin/servers', token);
  },

  /** @deprecated Use adminListServers */
  adminListInstances(token: string) {
    return request<AdminListInstancesResponse>('/api/admin/instances', token);
  },

  bootstrapStatus() {
    return requestPublic<BootstrapStatusResponse>('/api/bootstrap/status');
  },

  bootstrapCreateAdmin(input?: BootstrapCreateAdminRequest) {
    return requestPublic<BootstrapCreateAdminResponse>('/api/bootstrap/admin', {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    });
  },
};

export { ApiError };
