# iflytek-tts-bridge Specification

## Purpose
TBD - created by archiving change add-iflytek-tts. Update Purpose after archive.
## Requirements
### Requirement: WebSocket TTS 消息契约

`shared/contracts.ts` SHALL 新增四种消息类型：`tts.request`（client→server）、`tts.audio`（server→client）、`tts.done`（server→client）、`tts.error`（server→client）。`ClientMessageType` 与 `ServerMessageType` 联合类型 MUST 包含这些值。

#### Scenario: 前端发出 TTS 请求
- **WHEN** 前端发送 `{ type: 'tts.request', payload: { requestId, text, voice } }`
- **THEN** 后端能够通过 `handleMessage` 路由到 `tts.request` 处理器

#### Scenario: 后端推送音频帧
- **WHEN** 后端从讯飞收到一帧 PCM 数据
- **THEN** 后端发送 `{ type: 'tts.audio', payload: { requestId, seq, audio: <base64> } }`

### Requirement: 讯飞鉴权签名模块

后端 SHALL 在 `server/src/lib/xfyun-auth.ts` 提供 `buildXfyunTtsAuthUrl()` 函数，按讯飞官方算法（HMAC-SHA256 签名 + base64 编码）生成连接 `wss://tts-api.xfyun.cn/v2/tts` 用的鉴权 URL（含 `authorization`、`date`、`host` 三个 query 参数）。鉴权使用既有环境变量 `XFYUN_API_KEY` 与 `XFYUN_API_SECRET`（与发音评测共用同一账号）。底层 SHALL 复用既有的 `buildXfyunWsAuthUrl(host, path, apiKey, apiSecret)`。

#### Scenario: 三件套齐全时生成 URL
- **WHEN** 环境变量 `XFYUN_API_KEY` 与 `XFYUN_API_SECRET` 已设置，调用 `buildXfyunTtsAuthUrl()`
- **THEN** 返回形如 `wss://tts-api.xfyun.cn/v2/tts?authorization=...&date=...&host=tts-api.xfyun.cn` 的字符串

#### Scenario: 三件套缺失时拒绝
- **WHEN** `XFYUN_API_SECRET` 未设置时调用 `buildXfyunTtsAuthUrl()`
- **THEN** 函数抛出 `Error('XFYUN_API_SECRET is not set')`，调用方 catch 后向前端发送 `tts.error`

### Requirement: 讯飞 TTS 服务实现

后端 SHALL 在 `server/src/modules/tts.service.ts` 新增 `IflytekTtsService implements ITtsService`，实现 `synthesize(text, onChunk)`：连接讯飞 WSS、发送鉴权后的合成参数、接收并解码 base64 PCM 帧、通过 `onChunk` 回调推流。MUST 支持 voice 参数（默认值 `x4_EnUs_Catherine`）。

#### Scenario: 正常合成
- **WHEN** 调用 `iflytekTtsService.synthesize("Hello world", onChunk)` 且讯飞鉴权通过
- **THEN** `onChunk` 被多次调用，每次传入一帧 PCM `ArrayBuffer`，最后讯飞返回 `status=2`，方法 resolve

#### Scenario: 讯飞返回业务错误
- **WHEN** 讯飞返回 `code != 0`（如 AppId 未授权）
- **THEN** 方法 reject 抛出 `Error('Iflytek TTS error: <code> <message>')`，调用方需通过 `tts.error` 通知前端

### Requirement: WS 网关 TTS 路由

`ws-gateway.ts` SHALL 在 `handleMessage` 中识别 `tts.request` 类型并路由至 `handleTtsRequest`。该处理器 MUST：
1. 调用 `IflytekTtsService.synthesize`
2. 每帧通过 `tts.audio` 推送给当前 ws，payload 含 `requestId / seq / audio(base64)`
3. 完成后发送 `tts.done`
4. 失败时发送 `tts.error`

#### Scenario: TTS 请求独立于 session
- **WHEN** 前端尚未发送过 `session.start` 就直接发 `tts.request`
- **THEN** 后端仍能处理（TTS 无状态），不返回 `SESSION_NOT_FOUND`

#### Scenario: 失败上报
- **WHEN** `IflytekTtsService.synthesize` 抛错
- **THEN** 后端发送 `{ type: 'tts.error', payload: { requestId, code: 'TTS_FAILED', message } }` 而非崩溃

