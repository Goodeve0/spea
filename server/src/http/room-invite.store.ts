/**
 * 房间邀请的内存存储（一次性轮询送达）。
 * Phase 1 简化方案：不落库；读后标记 delivered，TTL 内自然过期清理。
 */

export const INVITE_TTL_MS = 10 * 60 * 1000;

interface RoomInvite {
  roomId: string;
  fromUserId: string;
  createdAt: number;
  delivered: boolean;
}

const invites = new Map<string, RoomInvite[]>(); // key: toUserId

function pruneExpired(list: RoomInvite[], now = Date.now()): RoomInvite[] {
  return list.filter((i) => now - i.createdAt < INVITE_TTL_MS);
}

/** 新增一条房间邀请（过期清理 + 同 roomId 去重，重置 delivered） */
export function addRoomInvite(toUserId: string, fromUserId: string, roomId: string): void {
  const now = Date.now();
  let list = pruneExpired(invites.get(toUserId) ?? [], now);
  list = list.filter((i) => i.roomId !== roomId);
  list.push({ roomId, fromUserId, createdAt: now, delivered: false });
  invites.set(toUserId, list);
}

/**
 * 读取某用户的待入房邀请：返回未过期且未 delivered 的快照，并就地标记 delivered。
 * 多 Tab / 多设备并发轮询时，第一次读到则后续不再返回；TTL 到期由 prune 移除。
 */
export function takeRoomInvites(toUserId: string): RoomInvite[] {
  const now = Date.now();
  const list = pruneExpired(invites.get(toUserId) ?? [], now);
  invites.set(toUserId, list);
  const undelivered = list.filter((i) => !i.delivered);
  for (const item of undelivered) {
    item.delivered = true;
  }
  return undelivered.map((i) => ({ ...i }));
}

/** 不修改状态，返回未过期且未 delivered 的条目数（用于访问日志） */
export function peekQueueSize(toUserId: string): number {
  const list = pruneExpired(invites.get(toUserId) ?? []);
  return list.filter((i) => !i.delivered).length;
}

/** 测试用：清空全部 */
export function clearRoomInvites(): void {
  invites.clear();
}
