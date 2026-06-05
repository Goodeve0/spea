import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { ApiError } from '../api/client';
import Mascot from '../components/ui/Mascot';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, displayName.trim() || undefined);
      navigate('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '网络错误，请确认后端已启动后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card border border-line p-8 animate-pop-in">
        <div className="flex flex-col items-center text-center mb-6">
          <Mascot size={80} className="animate-float" />
          <h1 className="text-2xl font-extrabold text-ink mt-3">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h1>
          <p className="text-sub text-sm mt-1">登录后练习记录会跨设备保存</p>
        </div>

        {/* 模式切换 */}
        <div className="flex p-1 bg-canvas rounded-2xl border border-line mb-5">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                mode === m ? 'bg-primary text-white shadow-pop' : 'text-sub hover:text-ink'
              }`}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="昵称（可选）"
              className="w-full px-4 py-2.5 rounded-2xl border border-line focus:border-primary focus:ring-2 focus:ring-primary-light outline-none text-sm"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full px-4 py-2.5 rounded-2xl border border-line focus:border-primary focus:ring-2 focus:ring-primary-light outline-none text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) submit(); }}
            placeholder="密码（至少 6 位）"
            className="w-full px-4 py-2.5 rounded-2xl border border-line focus:border-primary focus:ring-2 focus:ring-primary-light outline-none text-sm"
          />
        </div>

        {error && <p className="text-danger text-xs mt-3 text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || !email || !password}
          className="w-full mt-5 py-3 bg-primary text-white rounded-2xl font-extrabold border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-0 transition-all disabled:opacity-50 disabled:border-b-4"
        >
          {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并开始'}
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-3 py-2 text-sub text-sm font-medium hover:text-ink transition-colors"
        >
          以游客身份继续 →
        </button>
      </div>
    </div>
  );
}
