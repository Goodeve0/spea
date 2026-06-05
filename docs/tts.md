# TTS 引擎接入指南

> 双引擎架构：浏览器 SpeechSynthesis（默认） + 科大讯飞在线 TTS（自然音色）。

## 引擎抽象

`web/src/audio/tts-engine.ts` 定义统一接口：

```typescript
interface ITtsEngine {
  readonly id: 'browser' | 'iflytek';
  speak(text: string, options?: TtsSpeakOptions): void;
  stop(): void;
  isAvailable(): Promise<boolean>;
  dispose(): void;
}
```

注册表 + 工厂：

- `registerEngine(engine)` — 在 `tts-init.ts` 顶层注册两个内置引擎
- `getEngine(id)` — 拿指定 id 的实例
- `getCurrentEngine()` — 拿当前激活引擎；找不到则 fallback 到 browser 并 `console.warn`

## 切换流程

1. 用户点击 Conversation Header 齿轮 → 打开 `SettingsPanel`
2. 选择引擎 → 写入 `useSettingsStore`（zustand），同步落地 `localStorage['speak-coach.settings']`
3. `Conversation.speakReply` 每次发话前用 `getEngine(settings.ttsEngine)` 取当前引擎播放
4. 切换时旧引擎 `stop()`，避免叠音

## 讯飞链路

```
浏览器 ──tts.request{requestId,text,voice}──▶ 服务端 WS 网关
                                                  │
                                                  ▼
                                          IflytekTtsService
                                                  │
                                  wss://tts-api.xfyun.cn/v2/tts
                                                  │
                                          按帧 base64 PCM
                                                  │
                                                  ▼
浏览器 ◀──tts.audio{seq,audio}── tts.done── 服务端 WS 网关
```

- 鉴权：`server/src/lib/xfyun-auth.ts` 的 `buildXfyunTtsAuthUrl()`，HMAC-SHA256 + base64
- 音频格式：PCM 16kHz / 16bit / mono / RAW（`auf=audio/L16;rate=16000`，`aue=raw`）
- 浏览器播放：`web/src/audio/iflytek-tts-client.ts` 解码 base64 → Int16 → Float32 → AudioBufferSourceNode 队列调度

## 故障排查

| 现象 | 排查点 |
|------|--------|
| SettingsPanel 中讯飞选项灰显 + ⚠️ | 后端 `.env` 缺 `XFYUN_APP_ID/API_KEY/API_SECRET`，或 WS 5s 超时 |
| 选择讯飞后无声 | F12 看 console：是否收到 `tts.error`；后端日志 `[WsGateway.handleTtsRequest] failed` 找 reason |
| `Iflytek TTS error: 10005` | AppId 未在讯飞控制台开通"在线语音合成（流式版）" |
| `Iflytek TTS error: 10160` | API_KEY/API_SECRET 与 AppId 不匹配 |
| 切换后旧引擎仍在播 | 检查 `Conversation` 的引擎切换 cleanup（`useEffect` 依赖 `ttsEngineId`）|

## 添加新音色

修改 `web/src/audio/iflytek-voices.ts` 中的 `IFLYTEK_VOICES`，加上对应 `id`/`label`/`gender`。控制台支持的音色见：https://www.xfyun.cn/doc/tts/online_tts/API.html#%E5%8F%91%E9%9F%B3%E4%BA%BA%E5%88%97%E8%A1%A8

## 添加新引擎

1. 在 `web/src/audio/<engine>-tts-client.ts` 实现 `ITtsEngine`
2. 在 `tts-init.ts` 调 `registerEngine(new MyEngine())`
3. 扩展 `EngineId` 联合类型与 `SettingsPanel` 单选项
4. 若需后端中转，按 `tts.request` / `tts.audio` / `tts.done` / `tts.error` 契约新增消息类型与 service
