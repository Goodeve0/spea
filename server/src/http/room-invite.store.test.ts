import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INVITE_TTL_MS,
  addRoomInvite,
  clearRoomInvites,
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

  it('takeRoomInvites returns and clears pending invites', () => {
    addRoomInvite('user-b', 'user-a', 'room-1');
    const list = takeRoomInvites('user-b');
    expect(list).toHaveLength(1);
    expect(list[0]?.roomId).toBe('room-1');
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
});
