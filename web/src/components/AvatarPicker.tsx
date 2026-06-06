import { AVATAR_KEYS, type AvatarKey, useSettingsStore } from '../store/settings';
import { UserAvatar } from './user-avatar';

/**
 * 头像选择器弹层：展示 8 个哈密瓜风头像供用户切换。
 * 打开时显示，选中后自动关闭。
 */
export default function AvatarPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useSettingsStore((s) => s.avatarKey);
  const setAvatar = useSettingsStore((s) => s.setAvatarKey);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-pop border border-line p-6 w-[340px] animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-extrabold text-ink text-lg mb-4 text-center">选择头像</h3>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => { setAvatar(key); onClose(); }}
              className={`rounded-2xl p-2 transition-all flex items-center justify-center ${
                current === key
                  ? 'bg-primary-light ring-2 ring-primary scale-110'
                  : 'bg-canvas hover:bg-primary-light/50 hover:scale-105'
              }`}
            >
              <UserAvatar avatarKey={key} size={48} />
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-canvas text-sub font-bold hover:text-ink transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
