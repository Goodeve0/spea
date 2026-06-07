import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INVITE_TTL_MS,
  addRoomInvite,
  clearRoomInvites,
  peekQueueSize,
  takeRoomInvites,
} from './room-invite.store';

describe('room-invite.store', () => {
  beforeEach(() => {
    clearRoomInvites();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRoomInvites();
  });

  it('takeRoomInvites returns pending invites and marks them delivered', () => {
    addRoomInvite('user-b', 'user-a', 'room-1');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.roomId).toBe('room-1');
    expect(list[0]?.delivered).toBe(true);
    // 第二次读取：因首次已标记 delivered，不再返回
    expect(takeRoomInvites('user-b')).toEqual([]);
  });

  it('dedupes same roomId keeping the latest invite', () => {
    addRoomInvite('user-b', 'user-a', 'room-1');
    vi.advanceTimersByTime(1000);
    addRoomInvite('user-b', 'user-a', 'room-1');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.createdAt).toBe(Date.now());
  });

  it('drops expired invites on take', () => {
    addRoomInvite('user-b', 'user-a', 'room-old');
    vi.advanceTimersByTime(INVITE_TTL_MS + 1);
    addRoomInvite('user-b', 'user-a', 'room-new');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.roomId).toBe('room-new');
  });

  it('prunes expired invites on add', () => {
    addRoomInvite('user-b', 'user-a', 'room-old');
    vi.advanceTimersByTime(INVITE_TTL_MS + 1);
    addRoomInvite('user-b', 'user-a', 'room-new');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.roomId).toBe('room-new');
  });

  it('readd same roomId resets delivered so the next take returns it again', () => {
    addRoomInvite('user-b', 'user-a', 'room-1');
    expect(takeRoomInvites('user-b')).toHaveLength(1);
    expect(takeRoomInvites('user-b')).toEqual([]);

    addRoomInvite('user-b', 'user-a', 'room-1');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.roomId).toBe('room-1');
  });

  it('expired invites are not returned even if not yet delivered', () => {
    addRoomInvite('user-b', 'user-a', 'room-1');
    vi.advanceTimersByTime(INVITE_TTL_MS + 1);
    expect(takeRoomInvites('user-b')).toEqual([]);
  });

  it('peekQueueSize reflects undelivered count without mutating state', () => {
    expect(peekQueueSize('user-b')).toBe(0);
    addRoomInvite('user-b', 'user-a', 'room-1');
    expect(peekQueueSize('user-b')).toBe(1);
    // peek 不消耗
    expect(peekQueueSize('user-b')).toBe(1);
    takeRoomInvites('user-b');
    expect(peekQueueSize('user-b')).toBe(0);
  });
});
