/**
 * 房间邀请的内存存储（一次性轮询送达）。
 * Phase 1 简化方案：不落库，被邀请方轮询取走即清。
 */

export const INVITE_TTL_MS = 10 * 60 * 1000;

interface RoomInvite {
  roomId: string;
  fromUserId: string;
  createdAt: number;
}

const invites = new Map<string, RoomInvite[]>(); // key: toUserId

function pruneExpired(list: RoomInvite[], now = Date.now()): RoomInvite[] {
  return list.filter((i) => now - i.createdAt < INVITE_TTL_MS);
}

/** 新增一条房间邀请（过期清理 + 同 roomId 去重） */
export function addRoomInvite(toUserId: string, fromUserId: string, roomId: string): void {
  const now = Date.now();
  let list = pruneExpired(invites.get(toUserId) ?? [], now);
  list = list.filter((i) => i.roomId !== roomId);
  list.push({ roomId, fromUserId, createdAt: now });
  invites.set(toUserId, list);
}

/** 取走某用户的全部待入房邀请（取走即清，仅返回未过期） */
export function takeRoomInvites(toUserId: string): RoomInvite[] {
  const list = pruneExpired(invites.get(toUserId) ?? []);
  invites.delete(toUserId);
  return list;
}

/** 测试用：清空全部 */
export function clearRoomInvites(): void {
  invites.clear();
}
