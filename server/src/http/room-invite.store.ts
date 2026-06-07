/**
 * 房间邀请的内存存储（一次性轮询送达）。
 * Phase 1 简化方案：不落库；读后标记 delivered，TTL 内自然过期清理。
 */

export const INVITE_TTL_MS = 10 * 60 * 1000;

export interface RoomInvite {
  roomId: string;
  fromUserId: string;
  createdAt: number;
  delivered: boolean;
}

const invites = new Map<string, RoomInvite[]>(); // key: toUserId

function pruneExpired(list: RoomInvite[], now = Date.now()): RoomInvite[] {
  return list.filter((i) => now - i.createdAt < INVITE_TTL_MS);
}

function getList(toUserId: string, now = Date.now()): RoomInvite[] {
  const list = pruneExpired(invites.get(toUserId) ?? [], now);
  invites.set(toUserId, list);
  return list;
}

/** 新增一条房间邀请（过期清理 + 同 roomId 去重，重置 delivered） */
export function addRoomInvite(toUserId: string, fromUserId: string, roomId: string): void {
  const now = Date.now();
  let list = getList(toUserId, now);
  list = list.filter((i) => i.roomId !== roomId);
  list.push({ roomId, fromUserId, createdAt: now, delivered: false });
  invites.set(toUserId, list);
}

/** 读取未过期且未 delivered 的邀请（不修改状态） */
export function peekRoomInvites(toUserId: string): RoomInvite[] {
  return getList(toUserId).filter((i) => !i.delivered).map((i) => ({ ...i }));
}

/** 将指定 roomId 标记为 delivered（响应成功发出后调用） */
export function markRoomInvitesDelivered(toUserId: string, roomIds: string[]): void {
  if (roomIds.length === 0) return;
  const set = new Set(roomIds);
  const list = getList(toUserId);
  for (const item of list) {
    if (set.has(item.roomId)) {
      item.delivered = true;
    }
  }
}

/**
 * @deprecated 使用 peekRoomInvites + markRoomInvitesDelivered；保留供测试兼容
 */
export function takeRoomInvites(toUserId: string): RoomInvite[] {
  const pending = peekRoomInvites(toUserId);
  markRoomInvitesDelivered(
    toUserId,
    pending.map((i) => i.roomId),
  );
  return pending.map((i) => ({ ...i, delivered: true }));
}

/** 不修改状态，返回未过期且未 delivered 的条目数（用于访问日志） */
export function peekQueueSize(toUserId: string): number {
  return peekRoomInvites(toUserId).length;
}

/** 测试用：清空全部 */
export function clearRoomInvites(): void {
  invites.clear();
}
