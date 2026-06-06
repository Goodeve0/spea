import { useEffect } from 'react';

import { IFLYTEK_VOICES } from '../audio/iflytek-voices';
import type { EngineId } from '../audio/tts-engine';
import { PLAYBACK_SPEED_OPTIONS, useSettingsStore } from '../store/settings';

/** 简单的 iOS 风格开关按钮 */
function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const ttsEngine = useSettingsStore((s) => s.ttsEngine);
  const iflytekVoice = useSettingsStore((s) => s.iflytekVoice);
  const iflytekDisabled = useSettingsStore((s) => s.iflytekDisabled);
  const iflytekLastError = useSettingsStore((s) => s.iflytekLastError);
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const hintEnabled = useSettingsStore((s) => s.hintEnabled);
  const setTtsEngine = useSettingsStore((s) => s.setTtsEngine);
  const setIflytekVoice = useSettingsStore((s) => s.setIflytekVoice);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const setHintEnabled = useSettingsStore((s) => s.setHintEnabled);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleEngineChange = (engine: EngineId) => {
    if (engine === 'iflytek' && iflytekDisabled) return;
    setTtsEngine(engine);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* 卡壳提示开关 */}
          <section className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">卡壳提示</h3>
              <p className="text-xs text-gray-400 mt-0.5">不知道说啥时，AI 自动给出台阶话术（初学者友好）</p>
            </div>
            <Toggle id="hint-toggle" checked={hintEnabled} onChange={setHintEnabled} />
          </section>

          <div className="border-t border-gray-100" />

          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">语音合成引擎</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="tts-engine"
                  value="browser"
                  checked={ttsEngine === 'browser'}
                  onChange={() => handleEngineChange('browser')}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm text-gray-800">浏览器内置（免费、低延迟）</span>
              </label>
              <label
                className={`flex items-center gap-3 ${iflytekDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                title={iflytekDisabled ? '讯飞 TTS 不可用，请检查后端 .env 配置' : undefined}
              >
                <input
                  type="radio"
                  name="tts-engine"
                  value="iflytek"
                  checked={ttsEngine === 'iflytek'}
                  disabled={iflytekDisabled}
                  onChange={() => handleEngineChange('iflytek')}
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm text-gray-800">
                  科大讯飞（自然音色）
                  {iflytekDisabled && <span className="ml-1 text-amber-600">⚠️</span>}
                </span>
              </label>
            </div>
            {iflytekDisabled && (
              <p className="mt-2 text-xs text-amber-600">
                讯飞 TTS 不可用，请检查后端 .env 中的 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET。
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">播放速度</h3>
            <div className="flex flex-wrap gap-2">
              {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                <label
                  key={speed}
                  className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg border border-gray-200 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="playback-speed"
                    value={speed}
                    checked={playbackSpeed === speed}
                    onChange={() => setPlaybackSpeed(speed)}
                    className="w-3.5 h-3.5 text-indigo-600"
                  />
                  <span className="text-sm text-gray-800">{speed}x</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">切换后对下一句 AI 朗读生效</p>
          </section>

          {ttsEngine === 'iflytek' && (
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-2">讯飞音色</h3>
              <select
                value={iflytekVoice}
                onChange={(e) => setIflytekVoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
              >
                <optgroup label="英文音色（需在讯飞控制台开通）">
                  {IFLYTEK_VOICES.filter((v) => v.language === 'en-US').map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="中文音色（兜底，读英文有口音）">
                  {IFLYTEK_VOICES.filter((v) => v.language === 'zh-CN').map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              {iflytekLastError && (
                <p className="mt-2 text-xs text-amber-600 break-all">
                  上次失败：{iflytekLastError}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                提示：所选音色需在讯飞控制台「发音人授权」中开通。提示 <code className="font-mono">11119 vcn params is empty</code> 即未授权。
              </p>
            </section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
