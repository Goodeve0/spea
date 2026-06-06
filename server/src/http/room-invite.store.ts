/**
 * 房间邀请的内存存储（一次性轮询送达）。
 * Phase 1 简化方案：不落库，被邀请方轮询取走即清。
 */

interface RoomInvite {
  roomId: string;
  fromUserId: string;
  createdAt: number;
}

const invites = new Map<string, RoomInvite[]>(); // key: toUserId

/** 新增一条房间邀请 */
export function addRoomInvite(toUserId: string, fromUserId: string, roomId: string): void {
  const list = invites.get(toUserId) ?? [];
  list.push({ roomId, fromUserId, createdAt: Date.now() });
  invites.set(toUserId, list);
}

/** 取走某用户的全部待入房邀请（取走即清） */
export function takeRoomInvites(toUserId: string): RoomInvite[] {
  const list = invites.get(toUserId) ?? [];
  invites.delete(toUserId);
  return list;
}

/** 测试用：清空全部 */
export function clearRoomInvites(): void {
  invites.clear();
}
