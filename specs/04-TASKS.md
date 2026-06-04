# TASKS · 任务拆分与进度看板

> 把需求切成 **30 分钟内可完成、可独立测试验证** 的小任务。
> 能力一般的模型一次只领一个任务（一个 `[ ]`），做完跑测试变绿，再领下一个。
> **AI 必须按顺序执行，做完一个更新状态（`[ ]`→`[x]`）并写一行总结。**

---

## 使用方式

每个任务格式：

```
- [ ] T-XX  [模块] 任务标题
        Spec: 引用的 spec 章节 / Feature 文件
        DoD : 完成判定（通常=对应测试全绿）
```

给 AI 的领取话术：
> "执行 T-XX。先读 Spec 引用部分，按 TDD 先写测试（Red）再实现（Green）。
> 只改任务涉及的文件。完成后跑测试贴结果，并把 T-XX 标记为完成。"

---

## 阶段 0：项目骨架（Setup）

- [x] T-01  [repo] 初始化 monorepo：`web/`、`server/`、`shared/` 三包 + 根 workspace
        Spec: 02-SDD 第 2 节目录结构
        DoD : `npm install` 成功；三包可各自启动空进程
- [x] T-02  [shared] 落地 `shared/contracts.ts`，照抄 SDD 第 3 节数据模型 + 第 4 节消息类型 + ErrorCode
        Spec: 02-SDD 第 3、4 节
        DoD : 类型可被 web/server import，tsc 无错
- [x] T-03  [repo] 配置 Vitest（前后端）+ lint + `.env.example`
        Spec: 03-TDD 第 3 节；02-SDD 第 8 节
        DoD : `npm test` 可运行（0 用例也算通过）；`.env.example` 列全密钥

## 阶段 1：后端核心服务（先做可独立单测的，全程 mock 外部）

- [x] T-10  [server] `lib/llm-client.ts`：LLM 客户端封装（接口 + 真实实现 + 可注入）
        Spec: 02-SDD 第 5、8 节
        DoD : 接口 `complete()` 定义清晰；真实实现读 env；单测用 mock
- [x] T-11  [server] `correction.service`：语法纠错/表达升级（异步，结构化输出）
        Spec: 02-SDD 第 5 节 ICorrectionService；features/F02
        DoD : 03-TDD 第 6 节示例测试全绿（正常/空/非法JSON/抛错）
- [x] T-12  [server] `dialog.service`：开场白 + 流式回复（角色 prompt + 上下文）
        Spec: 02-SDD 第 5 节 IDialogService；features/F01
        DoD : greet/reply 单测绿；onDelta 被按句回调；上下文被携带
- [x] T-13  [server] `report.service`：聚合会话数据生成 Report
        Spec: 02-SDD 第 5 节 IReportService；01-PRD US-05
        DoD : 给定 mock 的 turns/corrections/pron，产出符合 Report 结构；雷达 5 维齐全
- [x] T-14  [server] `asr.service`：流式识别封装（push/onPartial/onFinal）
        Spec: 02-SDD 第 5 节 IAsrService
        DoD : 用 mock 驱动，验证回调时序；close 释放资源
- [x] T-15  [server] `tts.service`：流式合成（onChunk 回调）
        Spec: 02-SDD 第 5 节 ITtsService
        DoD : mock 下分片回调被触发；失败时不抛断对话（降级）
- [x] T-16  [server] `pronunciation.service`：Azure 发音评测封装
        Spec: 02-SDD 第 5 节 IPronunciationService；01-PRD US-03
        DoD : mock 下返回四维分；失败降级为估算并打标

## 阶段 2：实时网关（集成）

- [x] T-20  [server] `ws-gateway`：连接管理 + 消息信封路由
        Spec: 02-SDD 第 4 节消息契约
        DoD : 契约测试：收到各 type 正确分发；非法 type 返回 error
- [x] T-21  [server] 串联一轮对话：audio→asr→dialog→tts，按 SDD 时序推消息
        Spec: 02-SDD 第 6 节时序图
        DoD : 集成测试（mock AI）：客户端依次收到 asr.final→ai.text→ai.audio→ai.done
- [x] T-22  [server] 接入异步纠错（不阻塞主链路）+ session.end 触发报告
        Spec: 02-SDD 第 6 节；01-PRD US-04/US-05
        DoD : 纠错并行不延迟回复；session.end 后收到 report.ready

## 阶段 3：前端

- [x] T-30  [web] 场景中心页 ScenarioHub（场景卡片 + 难度选择）
        Spec: 01-PRD US-01；features 场景数据
        DoD : 渲染 ≥3 场景；选择后跳转并携带 scenarioId/difficulty
- [x] T-31  [web] `audio/` 录音 + 播放 + VAD 集成
        Spec: 01-PRD US-02 AC1；02-SDD 技术栈
        DoD : 能采集 PCM 分片；VAD 检测静音触发 end；能播放回传音频
- [x] T-32  [web] `ws-client` 封装 + zustand 会话状态机
        Spec: 02-SDD 第 4 节
        DoD : 收发消息映射到 store；断线自动重连
- [x] T-33  [web] 对话页 Conversation：实时字幕 + 语音播放 + 角色气泡
        Spec: 01-PRD US-02
        DoD : asr.partial 实时显示；ai 流式字幕+语音；延迟体感达标
- [x] T-34  [web] 报告页 Report：雷达图 + 错误TOP3 + 表达升级 + 逐句批注
        Spec: 01-PRD US-05
        DoD : 渲染 Report 各部分；雷达图用 Recharts；空数据有兜底

## 阶段 4：打磨与演示

- [ ] T-40  [all] 延迟优化：句级流式、首包计时埋点
        Spec: 01-PRD NFR；02-SDD 第 6 节
        DoD : 首包延迟 ≤1.5s（本地实测）
- [ ] T-41  [all] 离线兜底 Demo 路径（防现场网络）
        Spec: 01-PRD NFR 可演示性
        DoD : 断网下可用录制数据走通一轮 + 报告
- [ ] T-42  [web] UI 美化 + 加载/思考动效（掩盖延迟）
        Spec: 技术方案演示策略
        DoD : 视觉现代；等待有动效反馈

---

## 进度总览

| 阶段 | 任务数 | 完成 | 状态 |
|------|--------|------|------|
| 0 骨架 | 3 | 3 | ✅ |
| 1 后端服务 | 7 | 7 | ✅ |
| 2 网关 | 3 | 3 | ✅ |
| 3 前端 | 5 | 5 | ✅ |
| 4 打磨 | 3 | 0 | ⬜ |

> AI 每完成一个任务，更新对应行的完成数与本表。

---

## 变更日志（AI 每次完成后追加一行）

```
[日期] T-XX 完成：<一句话总结改动> | 测试：X passed
```
