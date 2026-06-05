## 1. 游戏化逻辑层

- [x] 1.1 新建 `web/src/lib/gamification.ts`：`levelInfo(totalXp)`（等级/级内进度/下一级阈值）
- [x] 1.2 成就定义表 + `evaluateAchievements(sessions, streak)`（首练/连击/累计/高分/多场景）
- [x] 1.3 `todayDone(sessions)` 每日目标判定
- [x] 1.4 `gamification.test.ts`：等级阈值、升级边界、成就解锁、每日目标（12 绿）

## 2. 顶栏重做

- [x] 2.1 新建 `web/src/components/ui/LevelBar.tsx`：等级徽章 + 进度条
- [x] 2.2 `ScenarioHub.tsx` 顶栏整合：Lv 进度 + 🔥连击 + 头像/登录

## 3. 即时奖励与庆祝

- [x] 3.1 新建 `web/src/components/RewardBanner.tsx`：本次 +XP / 连击 / 升级提示 + 等级进度
- [x] 3.2 `tailwind.config.js` 增加 `celebrate` 庆祝动画
- [x] 3.3 `Report.tsx` 顶部接入即时奖励；升级时触发庆祝

## 4. 成就墙

- [x] 4.1 新建 `web/src/components/AchievementWall.tsx`：徽章网格，已解锁高亮/未解锁灰显
- [x] 4.2 `ScenarioHub.tsx` 接入成就墙 + 每日目标提示

## 5. 报告页 UI 打磨

- [x] 5.1 报告页顶部加入奖励横幅，强化成就感（配合先前的青绿重做）

## 6. 验证

- [x] 6.1 `gamification.test.ts` 全绿
- [x] 6.2 web 类型检查 + 全量测试通过（35）
