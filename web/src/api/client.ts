/**
 * 后端 API 客户端（账号 / 数据持久化）。
 * 注意：与 LLM 代理（VITE_API_BASE_URL）区分，这里用 VITE_SERVER_URL。
 */
import type { Api, AuthResult, StoredSession, User, StickerKey } from '@speak-coach/shared';

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

  // -------- 瓜友 --------
  buddy: {
    updateProfile: (token: string, body: Api.UpdateProfileReq) =>
      request<{ ok: boolean }>('/me/profile', { method: 'PUT', token, body }),
    matches: (token: string, filters: { scenario?: string; slot?: string; lang?: string } = {}) => {
      const qs = new URLSearchParams();
      if (filters.scenario) qs.set('scenario', filters.scenario);
      if (filters.slot) qs.set('slot', filters.slot);
      if (filters.lang) qs.set('lang', filters.lang);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<Api.MatchesResp>(`/buddy/matches${suffix}`, { token });
    },
    sendRequest: (token: string, toUserId: string) =>
      request<{ ok: boolean }>('/buddy/requests', { method: 'POST', token, body: { toUserId } }),
    requests: (token: string) => request<Api.RequestsResp>('/buddy/requests', { token }),
    accept: (token: string, id: string) =>
      request<{ ok: boolean }>(`/buddy/requests/${id}/accept`, { method: 'POST', token }),
    decline: (token: string, id: string) =>
      request<{ ok: boolean }>(`/buddy/requests/${id}/decline`, { method: 'POST', token }),
    list: (token: string) => request<Api.BuddyListResp>('/buddy/list', { token }),
    remove: (token: string, buddyId: string) =>
      request<{ ok: boolean }>(`/buddy/${buddyId}`, { method: 'DELETE', token }),
    sendEncouragement: (token: string, toUserId: string, stickerKey: StickerKey) =>
      request<{ ok: boolean }>('/buddy/encouragements', { method: 'POST', token, body: { toUserId, stickerKey } }),
    encouragements: (token: string) => request<Api.EncouragementsResp>('/buddy/encouragements', { token }),
    ranking: (token: string) => request<Api.RankingResp>('/buddy/ranking', { token }),
    sendRoomInvite: (token: string, toUserId: string, roomId: string) =>
      request<{ ok: boolean }>('/buddy/room-invite', { method: 'POST', token, body: { toUserId, roomId } }),
    roomInvites: (token: string) => request<Api.RoomInviteResp>('/buddy/room-invite', { token }),
  },
};
