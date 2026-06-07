import { useEffect } from 'react';

import { useBuddyStore, type BuddyToastItem } from '../store/buddy';

const AUTO_DISMISS_MS = 3000;

function ToastItem({ item, onClose }: { item: BuddyToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, onClose]);

  return (
    <div
      role="status"
      className="flex items-center gap-2 px-4 py-3 bg-ink/90 text-white rounded-2xl shadow-pop text-sm font-bold animate-celebrate max-w-sm"
    >
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-white/70 hover:text-white px-1 leading-none"
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}

/** 全局瓜友 toast 栈（最多 3 条，3s 自动消失） */
export default function BuddyToast() {
  const toasts = useBuddyStore((s) => s.toasts);
  const removeToast = useBuddyStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none px-4 w-full max-w-md items-center">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full flex justify-center">
          <ToastItem item={item} onClose={() => removeToast(item.id)} />
        </div>
      ))}
    </div>
  );
}
