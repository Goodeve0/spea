# melon-buddy-discovery Specification

## Purpose
定义瓜友的**结构化匹配**与**瓜友卡片**展示：按学习维度匹配候选，卡片仅暴露学习数据，禁止任何交友向筛选。

## ADDED Requirements

### Requirement: 仅登录用户可用

瓜友发现 SHALL 仅对登录用户开放。游客（无 token）访问发现页 MUST 被引导登录，且 MUST NOT 调用任何 `/buddy/*` 接口。

#### Scenario: 游客访问发现页
- **WHEN** 未登录用户进入「瓜友/发现」页
- **THEN** 展示登录引导，不请求匹配候选

#### Scenario: 登录用户访问发现页
- **WHEN** 已登录用户进入发现页
- **THEN** 请求 `GET /buddy/matches` 并展示候选卡片

### Requirement: CEFR ±1 必须相近

匹配候选 MUST 满足 `|cefrLevel(候选) - cefrLevel(当前用户)| ≤ 1`（A1..C2 映射为 1..6）。当任一方无 CEFR 估算时，SHALL 视为可匹配（同级处理），不因缺数据而排除。

#### Scenario: 水平相近可匹配
- **WHEN** 当前用户 CEFR 为 B1，候选为 A2 / B1 / B2
- **THEN** 三者均进入候选

#### Scenario: 水平相差过大被排除
- **WHEN** 当前用户 CEFR 为 B1，候选为 C1
- **THEN** 该候选不进入候选列表

#### Scenario: 缺少 CEFR 视为可匹配
- **WHEN** 候选用户无任何已完成会话（无 CEFR）
- **THEN** 该候选仍可进入候选列表

### Requirement: 禁止交友向筛选维度

匹配筛选维度 MUST 仅限学习相关：目标场景、练习时段、母语背景。系统 MUST NOT 提供按性别、年龄、头像照片的筛选或展示。

#### Scenario: 仅暴露学习维度筛选
- **WHEN** 用户打开匹配筛选
- **THEN** 可选项仅为 场景 / 时段 / 母语，无性别/年龄/颜值项

### Requirement: 排除已有关系与自己

匹配候选 MUST 排除：当前用户自己、已成为瓜友者、与当前用户之间存在 pending 或 accepted 邀请者（任一方向）。

#### Scenario: 排除已是瓜友
- **WHEN** 候选 X 已是当前用户的瓜友
- **THEN** X 不出现在匹配候选中

#### Scenario: 排除已发出邀请
- **WHEN** 当前用户已向候选 Y 发出 pending 邀请
- **THEN** Y 不出现在匹配候选中

### Requirement: 瓜友卡片只露学习数据

瓜友卡片 SHALL 仅包含：系统 avatar（avatarKey）、昵称（displayName）、CEFR、本周练习次数、擅长场景（Top 2）、最近一次雷达图。卡片 MUST NOT 包含 email、真人照片、性别、年龄、精确作息时间。

#### Scenario: 卡片字段
- **WHEN** 渲染一张瓜友卡片
- **THEN** 显示 avatar/昵称/CEFR/本周次数/擅长场景/最近雷达，且不含 email 与真人照片

#### Scenario: 派生字段来自会话
- **WHEN** 计算候选的「本周练习次数 / 擅长场景 / 最近雷达 / CEFR」
- **THEN** 全部由该用户的 `Session` 记录派生，而非额外冗余存储

### Requirement: 候选排序与数量

匹配结果 SHALL 按 CEFR 距离升序、其次本周练习次数降序排序，并对同序项随机打散，返回不超过 20 条。

#### Scenario: 活跃且水平最近者优先
- **WHEN** 两候选 CEFR 距离相同
- **THEN** 本周练习次数更多者排在前面

### Requirement: 可公开 profile 同步

系统 SHALL 提供 `PUT /me/profile` 同步当前用户的可公开 profile：`avatarKey`、`nativeLang`、`practiceSlot`、`targetScenarios`。前端在登录态下修改 avatar 或偏好后 MUST 调用该接口持久化到服务端，以供他人卡片与匹配使用。

#### Scenario: 同步头像到服务端
- **WHEN** 登录用户在个人页切换 avatar
- **THEN** 调用 `PUT /me/profile` 更新服务端 `avatarKey`

#### Scenario: 游客切换头像不同步
- **WHEN** 游客切换 avatar
- **THEN** 仅写入本地 settings，不调用 `PUT /me/profile`
