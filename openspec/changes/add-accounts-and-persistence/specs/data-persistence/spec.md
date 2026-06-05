## ADDED Requirements

### Requirement: 会话与报告落库

每次练习的会话、对话轮次与生成的报告 SHALL 持久化到关系型数据库（PostgreSQL）。服务重启后这些数据 MUST 不丢失。

#### Scenario: 报告生成后落库
- **WHEN** 一次有效练习生成报告
- **THEN** 该会话的轮次与报告被写入数据库，关联到对应 `userId`

#### Scenario: 重启后仍可读取
- **WHEN** 服务重启后用户登录
- **THEN** 仍能读取到此前的历史会话与报告

### Requirement: 历史与成长数据检索

系统 SHALL 提供按用户、按时间检索历史会话的接口，并能据此计算成长数据（streak、累计 XP、5 维成长曲线）。

#### Scenario: 拉取成长数据
- **WHEN** 已登录用户打开首页或报告页
- **THEN** 从服务端获取其历史会话并据此计算 streak / XP / 成长曲线

### Requirement: 离线缓存兜底

前端 SHALL 在服务端不可达时使用本地缓存兜底展示，恢复连接后以服务端数据为准。

#### Scenario: 网络异常降级
- **WHEN** 拉取成长数据时网络异常
- **THEN** 展示本地缓存数据并提示"离线/同步失败"，不白屏

### Requirement: 音频回放字段预留

数据库 schema SHOULD 为会话/轮次预留音频引用字段（如对象存储 URL），以便后续（P2）接入音频回放，但本变更不实现音频存储本身。

#### Scenario: schema 预留
- **WHEN** 设计会话/轮次表
- **THEN** 包含可空的音频引用字段，不阻塞当前文本链路
