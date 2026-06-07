import { useEffect, useRef } from 'react';
import { STICKERS } from '@speak-coach/shared';

import { ApiError, api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useBuddyStore } from '../store/buddy';

const POLL_VISIBLE_MS = 5000;
const POLL_HIDDEN_MS = 15000;

/** 当前会话内是否已因 401 触发过登出，避免连续 401 多次跳转 */
let didLogout401 = false;

/** 登录用户全局轮询：贴纸通知 + 房间邀请 */
export default function BuddyInboxPoller() {
  const user = useAuthStore((s) => s.user);
  const mergeRoomInvites = useBuddyStore((s) => s.mergeRoomInvites);
  const showToast = useBuddyStore((s) => s.showToast);
  const resetInbox = useBuddyStore((s) => s.resetInbox);
  const shownEncouragementIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user) {
      shownEncouragementIdsRef.current.clear();
      didLogout401 = false;
      resetInbox();
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      const token = useAuthStore.getState().token;
      if (!token || !alive) return;
      try {
        const [encResult, invResult] = await Promise.all([
          api.buddy.encouragements(token),
          api.buddy.roomInvites(token),
        ]);
        if (!alive) return;

        for (const enc of encResult.encouragements) {
          if (enc.read || shownEncouragementIdsRef.current.has(enc.id)) continue;
          shownEncouragementIdsRef.current.add(enc.id);
          const sticker = STICKERS.find((s) => s.key === enc.stickerKey);
          const label = sticker?.label ?? enc.stickerKey;
          showToast(`${enc.from.displayName} 给你发了「${label}」`);
        }

        if (invResult.invites.length > 0) {
          mergeRoomInvites(invResult.invites);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          if (didLogout401) return;
          didLogout401 = true;
          if (alive && timer) clearInterval(timer);
          alive = false;
          console.warn('[BuddyInboxPoller.poll] token unauthorized, logging out');
          useAuthStore.getState().logout();
          window.location.assign('/login');
          return;
        }
        // 瞬时网络错 / 5xx：记录但不打扰用户，下一周期继续重试
        console.warn('[BuddyInboxPoller.poll] failed:', error);
      }
    };

    const schedule = () => {
      if (timer) clearInterval(timer);
      const ms = document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
      timer = setInterval(() => void poll(), ms);
    };

    void poll();
    schedule();

    const onVisibility = () => schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, mergeRoomInvites, showToast, resetInbox]);

  return null;
}
