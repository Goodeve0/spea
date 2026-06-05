/**
 * 注册前端可用的 TTS 引擎，供 getCurrentEngine() 使用。
 * 模块顶层执行一次，副作用注册到全局注册表。
 */

import { IflytekTtsEngine } from './iflytek-tts-client';
import { BrowserSpeechSynthesisEngine } from './speech-synthesis';
import { registerEngine } from './tts-engine';

let initialized = false;

export function initTtsEngines(): void {
  if (initialized) return;
  initialized = true;

  registerEngine(new BrowserSpeechSynthesisEngine());
  registerEngine(new IflytekTtsEngine());
}
