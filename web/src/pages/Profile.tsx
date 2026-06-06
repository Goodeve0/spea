import { useNavigate } from 'react-router-dom';

import Mascot from '../components/ui/Mascot';
import { useAuthStore } from '../store/auth';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold text-ink mb-6">👤 我的</h1>

      {user ? (
        <>
          {/* 账号卡 */}
          <section className="bg-white rounded-3xl border border-line shadow-card p-6 flex items-center gap-4 mb-6">
            <span className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-extrabold flex-shrink-0">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-ink truncate">{user.displayName}</div>
              <div className="text-sm text-sub truncate">{user.email}</div>
            </div>
          </section>

          <button
            onClick={logout}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-line text-danger font-extrabold hover:bg-danger/5 transition-colors"
          >
            退出登录
          </button>
        </>
      ) : (
        <section className="bg-white rounded-3xl border border-line shadow-card p-8 text-center">
          <Mascot size={80} className="mx-auto mb-4" />
          <p className="font-bold text-ink mb-1">登录后，瓜田永久保存</p>
          <p className="text-sm text-sub mb-5">换设备、换浏览器，你的瓜照样在田里等你</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-2xl bg-primary text-white font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all"
          >
            登录 / 注册
          </button>
        </section>
      )}
    </div>
  );
}
