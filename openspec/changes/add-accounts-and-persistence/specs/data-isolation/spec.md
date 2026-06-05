## ADDED Requirements

### Requirement: 服务端按用户隔离

所有涉及用户数据的服务端接口 SHALL 以鉴权 token 解析出的 `userId` 为数据边界。任一接口 MUST NOT 返回不属于当前用户的数据。

#### Scenario: 只能读到自己的数据
- **WHEN** 用户 A 请求历史会话
- **THEN** 仅返回 A 的会话，绝不包含其他用户的数据

#### Scenario: 越权访问被拒
- **WHEN** 用户尝试访问不属于自己的会话/报告 id
- **THEN** 返回 403/404，不泄露他人数据

### Requirement: 鉴权校验

需要用户数据的接口 SHALL 校验有效鉴权 token；无 token 或 token 失效 MUST 拒绝访问。

#### Scenario: 缺失 token
- **WHEN** 请求受保护接口但未带有效 token
- **THEN** 返回 401 未授权

### Requirement: 本地缓存命名空间隔离

前端本地缓存 SHALL 按 `userId` 命名空间隔离；同一浏览器切换不同账号时，缓存 MUST 互不污染。

#### Scenario: 同浏览器多账号
- **WHEN** 账号 A 登出后账号 B 登录
- **THEN** B 看不到 A 的任何本地缓存数据（streak/XP/会话）

#### Scenario: 游客与登录态隔离
- **WHEN** 游客数据存在，用户登录账号 B
- **THEN** 除非显式合并，B 的视图不混入游客残留数据
