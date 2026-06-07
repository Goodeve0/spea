import { describe, expect, it } from 'vitest';
import type { RoomInviteDTO } from '@speak-coach/shared';

import { mergeRoomInviteList, useBuddyStore } from './buddy';

const mockFrom = {
  userId: 'user-a',
  displayName: 'Alice',
  avatarKey: 'melon',
  cefr: 'B1',
  weeklyPracticeCount: 3,
  topScenarios: ['restaurant'],
  isSeed: false,
};

function invite(roomId: string, createdAt = 1): RoomInviteDTO {
  return { roomId, from: mockFrom, createdAt };
}

describe('mergeRoomInviteList', () => {
  it('merges by roomId keeping the latest entry', () => {
    const existing = [invite('room-1', 100)];
    const incoming = [invite('room-1', 200), invite('room-2', 300)];
    const merged = mergeRoomInviteList(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.roomId === 'room-1')?.createdAt).toBe(200);
    expect(merged.find((i) => i.roomId === 'room-2')?.createdAt).toBe(300);
  });

  it('returns existing when incoming is empty', () => {
    const existing = [invite('room-1')];
    expect(mergeRoomInviteList(existing, [])).toEqual(existing);
  });
});

describe('useBuddyStore inbox', () => {
  it('dismissRoomInvite removes by roomId', () => {
    useBuddyStore.setState({
      pendingRoomInvites: [invite('room-1'), invite('room-2')],
    });
    useBuddyStore.getState().dismissRoomInvite('room-1');
    expect(useBuddyStore.getState().pendingRoomInvites.map((i) => i.roomId)).toEqual(['room-2']);
  });

  it('showToast keeps at most 3 messages', () => {
    useBuddyStore.setState({ toasts: [] });
    const { showToast } = useBuddyStore.getState();
    showToast('a');
    showToast('b');
    showToast('c');
    showToast('d');
    expect(useBuddyStore.getState().toasts).toHaveLength(3);
    expect(useBuddyStore.getState().toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });
});
