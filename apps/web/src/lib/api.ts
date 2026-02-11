import type {
  ListServersResponse,
  ServerStatusResponse,
  PowerResponse,
  ErrorResponse,
} from '@aws-gaming/contracts';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
};

export { ApiError };
