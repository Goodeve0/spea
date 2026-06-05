# Design · add-accounts-and-persistence

> P1 产品化地基。唯一事实来源仍是 `shared/contracts.ts` 与各 capability spec，本文解释技术选型与落地路径。

## 1. 架构演进

现状：`main.ts` 手动实例化服务 + `WsGateway` 纯内存、无 HTTP、无 DB（`app.module.ts` 是空 stub）。

目标：在 WS 实时链路之外，新增 **HTTP API + 鉴权 + PostgreSQL 持久层**。

```
                ┌─────────── 前端（web，未来 PWA/Capacitor 复用）──────────┐
                │  登录态 store · API 客户端 · history(远程+本地缓存)        │
                └───────────────┬───────────────────────┬─────────────────┘
                                │ REST(JWT)              │ WS(实时对话，沿用)
                        ┌───────▼────────┐      ┌────────▼────────┐
                        │  HTTP API 层    │      │   WsGateway      │
                        │ auth/sessions/  │      │ (对话/ASR/TTS)   │
                        │ reports/growth  │      └────────┬────────┘
                        └───────┬────────┘               │ 报告落库
                                │                          │
                        ┌───────▼──────────────────────────▼───────┐
                        │   持久层（Repository / ORM）              │
                        └───────────────────┬──────────────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   PostgreSQL     │
                                   └─────────────────┘
```

## 2. 技术选型（已锁定 · 2026-06-06）

> 决策：保持 Node + TypeScript + Prisma + DB，WS 实时链路原样保留。
>
> **运行时约束说明**：后端用 `tsx`（esbuild）运行，esbuild 不生成装饰器元数据，
> 与 NestJS 自动 DI 不兼容。为零运行时改造、最快跑通，**HTTP 层改用轻量 Express**
> （鉴权中间件等价于 Nest Guard）。若未来要上 Nest，需先把运行时换成 ts-node/SWC，另行评估。

| 关注点 | 选定 | 说明 |
|--------|------|-------------|
| HTTP 框架 | **Express**（轻量） | 与 `tsx`/`ws` 运行时兼容；鉴权用中间件，路由按模块组织 |
| ORM / 迁移 | **Prisma** | schema 即文档、迁移强、类型安全 |
| 鉴权 | **JWT access token** + bcryptjs 哈希 | 纯 JS 实现，无需原生编译 |
| 数据库 | **SQLite**（dev/test）/ **PostgreSQL**（生产） | 报告明细以 JSON 文本字段存，保证跨库兼容 |

## 3. 数据模型（PostgreSQL）

```
User        { id PK, email/phone UNIQUE, passwordHash?, displayName, provider?, createdAt }
Session     { id PK, userId FK→User, scenarioId, difficulty, startedAt, endedAt?,
              overallScore, cefrEstimate?, hasUserSpeech, audioRef? (预留), createdAt }
Turn        { id PK, sessionId FK→Session, role('user'|'ai'), text, ts, audioRef? (预留) }
Report      { id PK, sessionId FK→Session UNIQUE, userId FK→User,
              radar JSONB, topErrors JSONB, expressionUpgrades JSONB, recasts JSONB,
              summaryText, createdAt }
```

- 所有用户数据表均带 `userId`，查询强制带 `WHERE userId = :current`（隔离基线）。
- `audioRef` 字段预留给 P2 音频回放（对象存储 URL），当前可空、不阻塞。
- 成长数据（streak/XP/曲线）由 `Session` 派生计算，不单独建表。

## 4. 契约变更（`shared/contracts.ts`）

```ts
export interface User { id: string; displayName: string; email?: string; }
export interface AuthResult { token: string; user: User; }

// HTTP DTO（示意）
export namespace Api {
  export interface RegisterReq { email: string; password: string; displayName?: string; }
  export interface LoginReq { email: string; password: string; }
  export interface MergeGuestReq { sessions: StoredSession[]; }
  export interface GrowthResp { streak: number; totalXp: number; sessions: StoredSession[]; }
}

// StoredSession 增加归属
export interface StoredSession { /* ...原字段... */ userId?: string; }
```

## 5. 鉴权流程

1. 注册：校验 → 哈希密码 → 建 User → 签 JWT。
2. 登录：查 User → 校验哈希 → 签 JWT。
3. 受保护接口：`Authorization: Bearer <jwt>` → 中间件解析 `userId` 注入请求上下文。
4. 游客：前端可无 token 使用，数据存本地（按"guest"命名空间）；登录后调 `POST /auth/merge` 上传并幂等合并（用客户端生成的稳定 `id` 去重）。

## 6. API（最小集）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册，返回 token + user |
| POST | `/auth/login` | 登录，返回 token + user |
| GET  | `/me` | 当前用户信息（校验 token） |
| POST | `/auth/merge` | 合并游客本地会话（幂等） |
| POST | `/sessions` | 提交一次会话 + 报告，落库 |
| GET  | `/sessions?limit=` | 当前用户历史会话（倒序） |
| GET  | `/growth` | streak / totalXp / 成长曲线数据 |

## 7. 前端改造与迁移路径

关键：把 [`history.ts`](web/src/store/history.ts) 抽象成接口，做"本地实现 + 远程实现"双态：

```
HistoryStore (interface): saveSession / listSessions / computeStreak / computeTotalXp
  ├─ LocalHistoryStore  : 现有 localStorage 实现，key 改为按 userId/guest 命名空间
  └─ RemoteHistoryStore : 走 HTTP API，本地缓存兜底
```

- 未登录 → LocalHistoryStore（guest 命名空间）。
- 登录 → RemoteHistoryStore（服务端为准，离线读本地缓存）。
- 登录瞬间 → 调 `/auth/merge` 把 guest 数据并入账号，再切到 Remote。
- 新增：登录/注册页、鉴权 store（token + user）、API 客户端；`Report.tsx` 落库改走 `/sessions`；`ScenarioHub.tsx` streak/XP 改 `/growth`。

## 8. 跨端预留（P3 才实现本体）

- API **无状态 + token 鉴权**，前端壳（PWA / Capacitor）可直接复用同一套调用。
- 业务逻辑尽量留在 `shared` 与 service 层，UI 层可替换。
- 本变更**不**实现移动端，只保证 API 设计对跨端友好。

## 9. 分阶段落地（降低风险）

1. **DB 地基**：接 Prisma + schema + migration + 本地 Postgres 跑通。
2. **Auth 最小闭环**：注册/登录/JWT/哈希 + `/me`。
3. **数据 API + 隔离**：`/sessions`、`/growth` + 鉴权中间件 + userId 边界。
4. **前端接入**：鉴权 store + API 客户端 + 登录注册页 + history 双态改造。
5. **游客合并**：`/auth/merge` 幂等。
6. **联调与测试**。

## 10. 风险与回退

| 风险 | 缓解 |
|------|------|
| 复杂度骤增 | 严格按 §9 分阶段，先跑通"注册→练习→落库→换设备看到"最小闭环 |
| 合并重复 | 用客户端稳定 id 幂等去重 |
| 无 Postgres 环境 | 提供 docker-compose 一键起库；dev 可用 SQLite 兜底（Prisma 支持） |
| 越权访问 | 所有查询强制带 userId；加越权单测 |
| 音频回放范围蔓延 | 明确划到 P2 单独立项，本期仅预留字段 |

## 11. 测试要点（TDD）

- Auth：注册/登录/错误凭证/哈希不可逆/token 校验。
- 隔离：A 不能读 B 的会话（越权返回 403/404）；缺 token 返回 401。
- 持久化：落库后重启可读；growth 计算正确。
- 合并：幂等（重复 merge 不产生重复）。
- 前端：未登录走 Local、登录走 Remote、离线兜底、登出清理缓存。
