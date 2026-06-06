/**
 * TTS 引擎抽象层
 * - 统一浏览器 SpeechSynthesis 与讯飞在线 TTS 的调用方式
 * - 通过注册表 + getCurrentEngine 实现运行时切换
 */

export type EngineId = 'browser' | 'iflytek';

/**
 * 启动超时阈值。引擎在 speak() 后若超时仍未真实发声（utterance.onstart 或首帧音频入队），
 * 必须主动 cancel 并触发 onError + onEnd，使上层 UI（readingTurnId 等）能复位，
 * 避免出现"显示正在朗读但实际无声"的卡死状态。
 * - 浏览器引擎纯本地，1500ms 足够覆盖正常启动抖动
 * - 讯飞引擎走 WS，3000ms 覆盖连接 + 首帧返回
 */
export const BROWSER_START_TIMEOUT_MS = 1500;
export const IFLYTEK_START_TIMEOUT_MS = 3000;

export interface TtsSpeakOptions {
  voice?: string;
  /** 播放速度倍率；未传时引擎回退读取 settings.playbackSpeed */
  rate?: number;
  /** 音频真实开始播放时触发，仅一次。启动超时被取消的会话不会触发。 */
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export interface ITtsEngine {
  readonly id: EngineId;
  speak(text: string, options?: TtsSpeakOptions): void;
  stop(): void;
  /** 是否可用：浏览器引擎检查 API 支持，讯飞引擎尝试 WS 探活 */
  isAvailable(): Promise<boolean>;
  dispose(): void;
}

const registry = new Map<EngineId, ITtsEngine>();
let activeId: EngineId = 'browser';

export function registerEngine(engine: ITtsEngine): void {
  registry.set(engine.id, engine);
}

export function unregisterEngine(id: EngineId): void {
  const engine = registry.get(id);
  if (!engine) return;
  try {
    engine.dispose();
  } catch (error) {
    console.error('[tts-engine.unregisterEngine] dispose failed, id:', id, error);
  }
  registry.delete(id);
}

export function setActiveEngine(id: EngineId): void {
  activeId = id;
}

export function getActiveEngineId(): EngineId {
  return activeId;
}

/**
 * 取当前激活的引擎实例。若不可用则回退到 browser，并打印 warn。
 * 注意：本函数同步返回，不做异步探活。可用性由调用方在切换时单独 isAvailable() 检查。
 */
export function getCurrentEngine(): ITtsEngine {
  const engine = registry.get(activeId);
  if (engine) return engine;

  const fallback = registry.get('browser');
  if (!fallback) {
    throw new Error('[tts-engine] no engine registered');
  }
  console.warn('[tts-engine.getCurrentEngine] active engine missing, fallback to browser, requested:', activeId);
  return fallback;
}

export function getEngine(id: EngineId): ITtsEngine | undefined {
  return registry.get(id);
}
