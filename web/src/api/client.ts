/**
 * 后端 API 客户端（账号 / 数据持久化）。
 * 注意：与 LLM 代理（VITE_API_BASE_URL）区分，这里用 VITE_SERVER_URL。
 */
import type { Api, AuthResult, StoredSession, User } from '@speak-coach/shared';

const BASE = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3002';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (body: Api.RegisterReq) =>
    request<AuthResult>('/auth/register', { method: 'POST', body }),
  login: (body: Api.LoginReq) =>
    request<AuthResult>('/auth/login', { method: 'POST', body }),
  me: (token: string) => request<User>('/me', { token }),
  merge: (token: string, sessions: StoredSession[]) =>
    request<{ merged: number }>('/auth/merge', { method: 'POST', token, body: { sessions } }),
  submitSession: (token: string, body: Api.SubmitSessionReq) =>
    request<{ ok: boolean }>('/sessions', { method: 'POST', token, body }),
  listSessions: (token: string) => request<StoredSession[]>('/sessions', { token }),
  growth: (token: string) => request<Api.GrowthResp>('/growth', { token }),
};
