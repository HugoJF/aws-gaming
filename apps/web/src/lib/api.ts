import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  ListServersResponse,
  ServerStatusResponse,
  ServerCostResponse,
  ServerPingResponse,
  TransitionResponse,
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
  PowerAction,
} from '@aws-gaming/contracts';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const http = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

function withAuth(
  token: string,
  config: AxiosRequestConfig,
): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    },
  };
}

function request<T>(
  path: string,
  token: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return http.request<T>(withAuth(token, { url: path, ...options }));
}

function requestPublic<T>(
  path: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return http.request<T>({ url: path, ...options });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorResponse(error: unknown): ErrorResponse | null {
  if (!axios.isAxiosError(error)) return null;

  const data = error.response?.data;
  if (!isRecord(data)) return null;
  if (typeof data.error !== 'string') return null;

  const body: ErrorResponse = { error: data.error };
  if (typeof data.detail === 'string') {
    body.detail = data.detail;
  }

  return body;
}

export function getHttpStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return error.response?.status ?? null;
}

export function getHttpErrorMessage(
  error: unknown,
  fallback: string = 'Request failed',
): string {
  const body = readErrorResponse(error);
  if (body?.detail) return `${body.error}: ${body.detail}`;
  if (body?.error) return body.error;

  if (isRecord(error) && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return fallback;
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

  getServerCost(token: string, serverId: string) {
    return request<ServerCostResponse>(`/api/servers/${serverId}/cost`, token);
  },

  pingServer(token: string, serverId: string) {
    return request<ServerPingResponse>(`/api/servers/${serverId}/ping`, token);
  },

  transition(token: string, serverId: string, action: PowerAction) {
    return request<TransitionResponse>(`/api/servers/${serverId}/power`, token, {
      method: 'POST',
      data: { action },
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
      data: input,
    });
  },

  adminUpdateToken(token: string, id: string, input: AdminUpdateTokenRequest) {
    return request<AdminUpdateTokenResponse>(`/api/admin/tokens/${id}`, token, {
      method: 'PATCH',
      data: input,
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
    return requestPublic<BootstrapCreateAdminResponse | ErrorResponse>('/api/bootstrap/admin', {
      method: 'POST',
      data: input ?? {},
      validateStatus: (status) => status === 409 || (status >= 200 && status < 300),
    });
  },
};
