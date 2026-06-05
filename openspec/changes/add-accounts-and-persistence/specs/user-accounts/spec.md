## ADDED Requirements

### Requirement: 注册与登录

系统 SHALL 提供注册与登录能力（邮箱或手机 + 验证码，或第三方 OAuth，至少其一）。注册成功后 SHALL 创建唯一 `userId` 的用户记录。

#### Scenario: 新用户注册
- **WHEN** 用户用未注册的邮箱/手机完成注册流程
- **THEN** 创建新用户并签发鉴权 token，进入已登录态

#### Scenario: 已有用户登录
- **WHEN** 用户用正确凭证登录
- **THEN** 校验通过并签发鉴权 token

#### Scenario: 凭证错误
- **WHEN** 用户凭证错误
- **THEN** 返回明确的认证失败错误，不泄露账号是否存在的细节

### Requirement: 凭证安全

如使用密码，密码 MUST 以单向哈希（如 bcrypt/argon2）存储，MUST NOT 明文落库或日志输出。鉴权 MUST 使用 token（如 JWT），传输 MUST 经 HTTPS/WSS。

#### Scenario: 密码哈希存储
- **WHEN** 用户设置密码
- **THEN** 数据库中仅存哈希值，无法反推明文

### Requirement: 游客模式与数据合并

系统 SHALL 允许未登录游客体验核心功能。用户登录后，SHALL 提供把本地游客产生的练习数据**合并**到账号的能力，且合并 MUST 幂等（重复合并不产生重复记录）。

#### Scenario: 游客转登录合并数据
- **WHEN** 游客练习过若干次后登录账号
- **THEN** 本地游客会话被合并到该账号，且不产生重复

### Requirement: 登出与隐私清理

用户登出后，本地 MUST NOT 残留可被下一个使用者查看的隐私数据（会话内容、报告等）。

#### Scenario: 登出清理
- **WHEN** 用户登出
- **THEN** 本地清除该用户的敏感缓存与 token，再次进入为未登录态
