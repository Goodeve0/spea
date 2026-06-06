import { useRef } from 'react';
import { AVATAR_KEYS, type AvatarKey, useSettingsStore } from '../store/settings';
import { useAuthStore } from '../store/auth';
import { UserAvatar } from './user-avatar';

/**
 * 头像选择器弹层。
 *  - 登录用户：可从头像库选择 OR 上传本地图片（压缩为 200px 内 JPEG，存 data URL）
 *  - 游客：只能从头像库选，无上传入口
 * 选中后自动关闭。
 */
export default function AvatarPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useSettingsStore((s) => s.avatarKey);
  const customAvatarUrl = useSettingsStore((s) => s.customAvatarUrl);
  const setAvatar = useSettingsStore((s) => s.setAvatarKey);
  const setCustomAvatarUrl = useSettingsStore((s) => s.setCustomAvatarUrl);
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  /** 选头像库 → 清掉自定义头像 */
  const handleSelectKey = (key: AvatarKey) => {
    setCustomAvatarUrl(null);
    setAvatar(key);
    onClose();
  };

  /** 上传本地图片 → 压缩成 data URL 存入 store */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // 压缩到最大 200px，保持比例
        const MAX = 200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCustomAvatarUrl(dataUrl);
        onClose();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    // 重置 input，同一文件再次选择时仍触发 onChange
    e.target.value = '';
  };

  const isLoggedIn = !!user;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-pop border border-line p-6 w-[340px] animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-extrabold text-ink text-lg mb-4 text-center">选择头像</h3>

        {/* 上传本地照片（仅登录用户） */}
        {isLoggedIn && (
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-light/30 text-primary font-bold text-sm hover:bg-primary-light/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {customAvatarUrl ? '更换本地照片' : '上传本地照片'}
            </button>
            {customAvatarUrl && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <img src={customAvatarUrl} alt="当前自定义头像" className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
                <button
                  onClick={() => { setCustomAvatarUrl(null); }}
                  className="text-xs text-danger hover:underline"
                >
                  移除自定义头像
                </button>
              </div>
            )}
            <p className="text-xs text-sub text-center mt-1">支持 JPG / PNG，自动压缩到 200px</p>
          </div>
        )}

        {/* 游客提示 */}
        {!isLoggedIn && (
          <p className="text-xs text-sub text-center mb-3 bg-canvas rounded-xl py-2 px-3">
            登录后可上传本地照片作为头像
          </p>
        )}

        {/* 头像库 */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {AVATAR_KEYS.map((key) => {
            const isActive = !customAvatarUrl && current === key;
            return (
              <button
                key={key}
                onClick={() => handleSelectKey(key)}
                className={`rounded-2xl p-2 transition-all flex items-center justify-center ${
                  isActive
                    ? 'bg-primary-light ring-2 ring-primary scale-110'
                    : 'bg-canvas hover:bg-primary-light/50 hover:scale-105'
                }`}
              >
                <UserAvatar avatarKey={key} size={48} />
              </button>
            );
          })}
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
