import { useNavigate } from 'react-router-dom';

import { useBuddyStore } from '../store/buddy';
import { UserAvatar } from './user-avatar';
import type { AvatarKey } from '../store/settings';

/** 全局房间邀请横幅 */
export default function BuddyInviteBanner() {
  const navigate = useNavigate();
  const pendingRoomInvites = useBuddyStore((s) => s.pendingRoomInvites);
  const dismissRoomInvite = useBuddyStore((s) => s.dismissRoomInvite);

  if (pendingRoomInvites.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-4 pt-3 pointer-events-none">
      <div className="max-w-3xl mx-auto space-y-2 pointer-events-auto">
        {pendingRoomInvites.map((inv) => (
          <div
            key={inv.roomId}
            className="flex items-center gap-3 bg-accent/95 backdrop-blur border border-accent/40 rounded-2xl px-4 py-3 shadow-pop"
          >
            <UserAvatar avatarKey={(inv.from.avatarKey as AvatarKey) ?? 'melon'} size={36} />
            <div className="flex-1 text-sm min-w-0">
              <span className="font-bold text-ink">{inv.from.displayName}</span>
              <span className="text-ink/80"> 邀请你双排练习</span>
            </div>
            <button
              type="button"
              onClick={() => {
                dismissRoomInvite(inv.roomId);
                navigate(`/room/${inv.roomId}`);
              }}
              className="px-4 py-1.5 bg-primary text-white rounded-xl text-sm font-bold shrink-0"
            >
              加入
            </button>
            <button
              type="button"
              onClick={() => dismissRoomInvite(inv.roomId)}
              className="text-ink/60 hover:text-ink px-1 shrink-0"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
