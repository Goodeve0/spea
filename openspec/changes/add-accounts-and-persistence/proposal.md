## Why

产品从"黑客松 Demo"升级为"可投入使用的产品"（见 PRD v2 第 7、8 节）。当前架构有三个硬伤，阻断了一切产品化能力：

1. **后端无持久化**：会话态仅存于内存（`main.ts` 直接实例化、`WsGateway` 内存会话），**重启即丢**，无法回放历史、无法做成长曲线。
2. **前端数据不隔离**：成长数据存浏览器 localStorage 全局 key（`web/src/store/history.ts`），**同一浏览器多个用户互相污染**，换设备即丢，无法跨端同步。
3. **无账号体系**：无法把数据"绑到人"，US-07/US-08/US-09 全部无从谈起。

本变更建设产品化地基（P1）：**账号体系 + 服务端数据库持久化 + 数据按用户隔离 + 后端 API 化**，为后续音频回放、游戏化、跨端铺平道路。

## What Changes

- 新增 **后端 HTTP API 层**：在现有 WS 网关之外引入 REST（鉴权 + 数据读写），后端从"纯内存 WS"演进为"API + DB"。
- 新增 **关系型数据库（PostgreSQL）持久化**：`users / sessions / turns / reports` 表；服务端按 `userId` 隔离存取。
- 新增 **账号与鉴权**：注册/登录（邮箱或手机 + 验证码 / 或 OAuth 其一）、密码哈希、JWT 鉴权、游客模式与登录后数据合并。
- 新增 **前端鉴权与数据接入**：登录态管理、API 客户端、把 `history` 从纯 localStorage 改为"服务端为准 + 本地缓存按 userId 命名空间"。
- **Modified**：报告生成后改为**写入服务端**（而非仅 localStorage）；首页 streak/XP/成长曲线改为**从服务端拉取**（仍保留离线缓存兜底）。

## Capabilities

### New Capabilities

- `user-accounts`：账号与鉴权能力。约束：支持注册/登录与游客模式；密码 MUST 哈希存储；鉴权 MUST 用 token；登录后 MUST 可把游客本地数据合并到账号；登出 MUST NOT 残留他人可见隐私数据。
- `data-persistence`：服务端持久化能力。约束：会话/轮次/报告 MUST 落库；服务重启后数据 MUST 不丢；提供按时间检索历史会话与成长数据的接口。
- `data-isolation`：数据隔离能力。约束：所有数据访问 MUST 以鉴权用户的 `userId` 为边界；任一接口 MUST NOT 返回他人数据；同一浏览器多账号切换本地缓存 MUST 互不污染。

### Modified Capabilities

- `growth-tracking`（来自 add-coaching-enhancements）：数据源从"纯本地 localStorage"升级为"服务端为准 + 本地按 userId 缓存"。原"无账号本地存储"的实现被本变更取代，但对外行为（streak/XP/成长曲线）保持兼容。

## Impact

**契约**
- 修改：`shared/contracts.ts` —— 新增 `User`、`AuthToken`、HTTP API 的请求/响应 DTO；`StoredSession` 增加 `userId`。

**后端**
- 新增：HTTP 服务（鉴权中间件、`/auth/*`、`/sessions`、`/reports`、`/growth` 等路由）
- 新增：数据库访问层（ORM/Query，如 Prisma 或 TypeORM）+ migrations + 实体
- 新增：`AuthService`（注册/登录/校验/哈希/JWT）、`SessionRepository`、`ReportRepository`
- 修改：`ws-gateway.ts` 在生成报告后写库（或由前端经 HTTP 落库）；`main.ts` 启动 HTTP + 注入 DB 连接

**前端**
- 新增：登录/注册页、鉴权 store、API 客户端、游客→登录数据合并
- 修改：`web/src/store/history.ts` 改为服务端为准 + 本地按 `userId` 命名空间缓存
- 修改：`Report.tsx` 报告落库走服务端；`ScenarioHub.tsx` streak/XP 从服务端拉取

**配置 / 依赖**
- 后端新增：数据库驱动 + ORM（Prisma/TypeORM）、JWT 库、密码哈希库（bcrypt/argon2）
- 新增 `.env`：`DATABASE_URL`、`JWT_SECRET`、（验证码/OAuth 相关 key）
- 部署：需提供 PostgreSQL 实例

**风险**
- 引入 DB 与鉴权显著增加复杂度 → 分层落地，先跑通"注册/登录 + 报告落库 + 成长拉取"最小闭环。
- 数据迁移：已存在的 localStorage 游客数据 → 登录后一次性合并，需幂等防重复。
- 跨端预留：API 设计保持无状态、token 鉴权，前端壳（PWA/Capacitor）可直接复用，本变更不实现移动端本体（属 P3）。
- 音频回放（US-09-AC2）依赖对象存储，**不在本变更范围**（P2 单独立项），但 DB schema 预留音频引用字段。
