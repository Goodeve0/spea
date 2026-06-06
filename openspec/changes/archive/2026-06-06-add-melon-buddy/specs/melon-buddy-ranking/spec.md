# melon-buddy-ranking Specification

## Purpose
定义瓜友间的**本周练习次数排行**与**瓜友连胜**——只在瓜友圈内，无全站明星/KOL/粉丝数体系。

## ADDED Requirements

### Requirement: 瓜友本周练习次数排行

登录用户 SHALL 能 `GET /buddy/ranking` 获取「自己 + 所有瓜友」的本周练习次数排行（降序）。本周 MUST 以本地周一 0 点为起点。排行 MUST 仅包含瓜友圈，MUST NOT 包含非瓜友或全站用户。

#### Scenario: 排行只含瓜友圈
- **WHEN** A 有瓜友 B、C，且存在非瓜友 D
- **THEN** `GET /buddy/ranking` 返回 A/B/C，不含 D

#### Scenario: 按本周次数降序
- **WHEN** A 本周练 5 次、B 练 3 次、C 练 8 次
- **THEN** 排行顺序为 C、A、B

#### Scenario: 仅统计本周
- **WHEN** B 上周练习多次但本周 0 次
- **THEN** B 的本周次数计为 0

### Requirement: 当前用户高亮

排行结果 SHALL 标识当前用户自身条目，便于前端高亮。

#### Scenario: 标识自己
- **WHEN** A 请求排行
- **THEN** A 自己的条目带有 `isSelf=true` 标识

### Requirement: 瓜友连胜

每对瓜友 SHALL 计算「瓜友连胜」天数：取双方各自练习的自然日集合求交集，从今天（或昨天）起向前连续计数。任一方某日未练习则连胜中断。

#### Scenario: 双方连续同日练习
- **WHEN** A 与 B 连续 3 天都有练习记录
- **THEN** 该对瓜友连胜为 3

#### Scenario: 一方中断连胜归零起算
- **WHEN** 最近一天只有 A 练习、B 未练习
- **THEN** 连胜从该断点中断（按今天或昨天的连续交集计算）

#### Scenario: 复用日历算法
- **WHEN** 计算瓜友连胜
- **THEN** 使用与个人 streak 相同的「今天或昨天起向前连续自然日」判定逻辑
