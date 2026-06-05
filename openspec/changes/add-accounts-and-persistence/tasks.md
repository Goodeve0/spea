## 1. 数据库地基

- [x] 1.1 选定并接入 ORM（Prisma 5，适配 Node 18），加 `server` 依赖与脚本（db:generate/migrate/studio）
- [x] 1.2 定义 schema：`User / Session / Turn / Report`（含 `userId` 外键、`audioRef` 预留字段）
- [x] 1.3 编写首个 migration，本地 SQLite 跑通
- [ ] 1.4 提供 `docker-compose` 一键起 Postgres（生产）；当前 dev 用 SQLite 文件
- [x] 1.5 新增 `.env` + `.env.example`：`DATABASE_URL`、`JWT_SECRET`、`HTTP_PORT`

## 2. 契约（shared/contracts.ts）

- [x] 2.1 新增 `User`、`AuthResult`
- [x] 2.2 新增 `Api` 命名空间 DTO：`RegisterReq / LoginReq / MergeGuestReq / SubmitSessionReq / GrowthResp`
- [x] 2.3 `StoredSession` 增加可选 `userId`
- [ ] 2.4 `contracts.test.ts` 补新增类型的形状校验

## 3. 后端：鉴权

- [x] 3.1 引入轻量 Express HTTP 层（与现有 WS 并存；因 tsx/esbuild 不 emit 装饰器元数据，未用 Nest DI）
- [x] 3.2 `auth.service`：注册（哈希）/登录（校验）/签发与校验 JWT
- [x] 3.3 密码用 bcryptjs 哈希，禁止明文落库/日志
- [x] 3.4 鉴权中间件：解析 `Authorization: Bearer` → 注入 `userId`
- [x] 3.5 路由：`POST /auth/register`、`POST /auth/login`、`GET /me`
- [x] 3.6 单测：注册/登录/错误凭证/哈希不可逆/token 校验

## 4. 后端：数据持久化与隔离

- [x] 4.1 `repo`：按 `userId` 读写 session/report/turn
- [x] 4.2 `POST /sessions`：提交一次会话 + 报告，落库并绑定 `userId`
- [x] 4.3 `GET /sessions`：仅返回当前用户、按时间倒序
- [x] 4.4 `GET /growth`：计算并返回 streak / totalXp / 成长曲线数据
- [x] 4.5 所有查询强制带 `userId` 边界；越权返回 403；缺 token 返回 401
- [x] 4.6 单测：落库后可读、越权被拒、growth 计算正确、report/turns 写入

## 5. 后端：游客数据合并

- [x] 5.1 `POST /auth/merge`：接收游客本地会话并合并到账号
- [x] 5.2 用客户端稳定 `id` 幂等去重
- [x] 5.3 单测：幂等合并

## 6. 前端：鉴权与接入

- [x] 6.1 新增鉴权 store（token + user，持久化）
- [x] 6.2 新增 API 客户端（注入 token、统一错误处理、独立 `VITE_SERVER_URL`）
- [x] 6.3 新增登录/注册页 + 游客模式入口
- [x] 6.4 `history.ts` 重构为命名空间本地存储 + 纯计算；新增 `growth.ts` 协调（远程+本地缓存兜底）
- [x] 6.5 登录后调 `/auth/merge` 合并游客数据
- [x] 6.6 `Report.tsx` 报告落库改走 `recordSession`（登录→服务端 / 游客→本地）
- [x] 6.7 `ScenarioHub.tsx` streak/XP 改从 `loadGrowth` 拉取 + 顶栏登录/用户入口
- [x] 6.8 登出：清理 token 与当前用户本地缓存
- [ ] 6.9 前端鉴权/growth 流程单测（history 命名空间隔离已覆盖；auth/growth 待补）

## 7. 验证与文档

- [ ] 7.1 端到端手动联调：注册 → 练习 → 换浏览器登录看到历史（需本地起后端 + DB）
- [x] 7.2 多账号隔离：后端 api.test 已覆盖（A 看不到 B）
- [x] 7.3 单测全绿：server 86 / web 23 / shared 3
- [x] 7.4 类型检查：web & shared `tsc --noEmit` 通过
- [ ] 7.5 更新 `英语口语陪练-技术方案.md`：记录后端 API、DB schema、鉴权与隔离方案
