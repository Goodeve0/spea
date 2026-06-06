# Skills 使用指南

> spea 项目的 Claude Code skills 总览。本文档介绍每个 skill 的作用、何时使用、以及它们之间的协作关系。

---

## 总览

skills 分为三组：

1. **OpenSpec 工作流核心**（10 个 `openspec-*`）：基于 [openspec](https://www.npmjs.com/package/openspec) CLI 的变更生命周期管理
2. **需求与拆分**（5 个）：需求澄清、确认、拆分多个独立 change
3. **项目上下文与代码规范**（3 个）：生成项目知识库 + React 编码规范

调用方式：在对话中说 "用 X skill"，或直接发 `/skill-name`（部分有简写命令）。

---

## 一、OpenSpec 工作流核心

OpenSpec 把每个有意义的变更（feature / fix / refactor）建成一个 **change**，包含 proposal / specs / design / tasks 四类工件。这套流程让 AI 输出的方案有结构、可追溯。

`spea` 已安装 openspec CLI（`/Users/temptrip/.nvm/versions/node/v20.11.1/bin/openspec`），并在 `openspec/` 下放好了 `config.yaml`、`schemas/`、`rules/`、`changes/` 目录。

### 推荐起手姿势

```
/opsx:onboard                  # 第一次用？跟着引导走一遍流程
/opsx:explore                  # 还没想清楚？先和 AI 思考伙伴模式聊聊
```

### 核心流程（按时间顺序）

| Skill | 命令 | 何时用 | 作用 |
|-------|------|--------|------|
| `openspec-new-change` | `/opsx:new <name>` | 想做一个新的功能/修复 | 创建 change 目录骨架，引导走完 proposal→specs→design→tasks |
| `openspec-continue-change` | `/opsx:continue <name>` | change 创建到一半暂停了 | 检查还缺哪个工件，继续推进下一步 |
| `openspec-ff-change` | `/opsx:ff <name>` | 想直接一把生成全部工件 | 跳过分步交互，一次性产出 proposal/specs/design/tasks |
| `openspec-apply-change` | `/opsx:apply <name>` | 工件都齐了，开始写代码 | 按 tasks.md 逐项实现，自动勾选完成项 |
| `openspec-verify-change` | `/opsx:verify <name>` | 实现完了准备归档 | 三维度检查（完整性 / 正确性 / 一致性），输出验证报告 |
| `openspec-archive-change` | `/opsx:archive <name>` | 验证通过 | 把 change 移到 `changes/archive/` 并合并 spec 到主 spec |
| `openspec-bulk-archive-change` | `/opsx:bulk-archive` | 多个 change 同时归档 | 批量归档已完成的 change |
| `openspec-sync-specs` | `/opsx:sync <name>` | 想提前把增量 spec 合到主 spec | 不归档但同步 spec |
| `openspec-explore` | `/opsx:explore` | 需求/设计还很模糊 | 思考伙伴模式：探索想法、调查问题，不急着落地 |
| `openspec-onboard` | `/opsx:onboard` | 新人首次接触 OpenSpec | 走一遍完整 demo，理解工作流 |

### 典型生命周期

```
/opsx:new add-pronunciation-radar
   └→ 进入引导：写 proposal、增量 spec、design、tasks
/opsx:apply add-pronunciation-radar
   └→ 按 tasks 逐项实现
/opsx:verify add-pronunciation-radar
   └→ 检查未完成任务、需求覆盖、设计遵守
/opsx:archive add-pronunciation-radar
   └→ 归档 + 合并 spec
```

---

## 二、需求与拆分

### `requirements-clarify`

**何时用**：拿到一份 PRD / 设计稿，里面有很多模糊点，需要先把不清楚的地方列出来再动手。

**做什么**：扫描需求文档，输出一份 JSON 格式的澄清问题列表（`clarification-questions.json`）。每个问题指向具体的需求条目，带类型（单选/多选/文本/确认）和默认值。

**典型用法**：
```bash
/clarify ./requirements-input --change add-scenario-picker
/clarify --files ./prd.md --change add-scenario-picker --mcp openai
```

输出文件之后，由可视化系统或人工填写 `clarification-answers.json`，然后用 `requirements-confirm` 整合。

### `requirements-confirm`

**何时用**：澄清问题已经被回答了，需要把问答整合成最终的需求规格说明书。

**做什么**：读取 questions+answers，生成 `clarified-requirements.md`，作为后续 design / tasks 的输入。

### `split-clarify`

**何时用**：需求量很大（超过 5 条），不适合放在一个 change 里做。

**做什么**：扫描需求条目，按"技术 / 范围 / 业务"三维度做关联分析，把需求聚类到多个独立 change，输出 `split-plan` JSON，并指定执行阶段（哪些组并行、哪些串行）。然后**中断等待用户在可视化系统里确认**。

**对 spea 这种黑客松小项目**：通常一个 change 就够了，但如果以后做完整产品（账号系统 / 场景管理 / 报告 / 学习路径同时开工），这个 skill 能避免一个巨型 change 失控。

### `split-confirm`

**何时用**：用户在可视化系统里把 `split-plan` 的 `status` 改成了 `confirmed` 之后。

**做什么**：根据已确认的 split-plan，为每个组创建独立 change 目录，并为每个 change 生成自己的澄清问题。

### `split-plan-check`

**何时用**：怀疑 split-plan 有遗漏（某些原始需求没被分到任何组）。

**做什么**：对比原始文档和 split-plan，把遗漏的需求补回去。

### 完整流程

```
PRD → /split-clarify → split-plan.json → 用户确认 → /split-confirm → 多个 change
                                                                       │
                              每个 change 走：/clarify → /requirements-confirm → /opsx:continue
```

---

## 三、项目上下文与代码规范

### `project-context-design`

**别名命令**：`/ctx-design`

**何时用**：第一次用这个 skill 体系；或者代码结构有大变动想刷新文档。

**做什么**：扫描 `server/` `web/` `shared/`，生成 6 个维度的开发知识库到 `openspec/project-context-design/`：

| 文件 | 内容 |
|------|------|
| `_index.md` | 项目概览 + 维度导航 |
| `dimension-architecture.md` | 技术栈、目录约定、编码规范、环境变量 |
| `dimension-reusable.md` | 工具函数 / Hook / 服务 / 组件清单（可复用能力） |
| `dimension-dev-patterns.md` | 修改模式（怎么加一个新页面 / 服务 / API）、API 契约 |
| `dimension-business-code.md` | 业务概念→文件映射、模块依赖、变更影响 |
| `dimension-cross-cutting.md` | 鉴权 / 错误处理 / 埋点 / 日志的接入方式 |
| `dimension-decisions.md` | 历史决策、踩坑、技术债 |

**作用**：让后续的 AI 对话能"看懂"项目，写出风格一致的代码、复用已有轮子，而不是另起炉灶。

```bash
/ctx-design                    # 首次生成
/ctx-design --update           # 全部重生成
/ctx-design --dimension reusable   # 只更新一个维度
```

### `project-context-requirements`

**别名命令**：`/ctx-req`

**何时用**：项目有大量业务模块（场景中心、对话引擎、报告 …），想给 AI 一份业务知识库。

**做什么**：和 `project-context-design` 配对，前者是"代码视角"，这个是"业务视角"。生成业务模块文档到 `openspec/project-context-requirements/`。

### `vercel-react-best-practices`

**何时用**：在 `web/src/**` 里写 React 组件、做性能优化、改状态管理时。

**做什么**：自动 inject React 18 + Vite + Zustand 的最佳实践（已为 spea 项目改写）：

- useMemo / useCallback 何时该用
- Zustand 选择器粒度
- 组件拆分（≤200 行）
- WebSocket / 音频副作用必须有清理函数
- 大型依赖（recharts / vad-web）懒加载

可以视作"PR 自检清单"：写完一个 React 模块，对照检查清单 6 条全过再提交。

### `design-confirm`

**何时用**：在 OpenSpec 流程里，design 阶段同步生成了 `design-questions.json`，用户回答后想把答案回填到 `design.md`。

**做什么**：读取 questions+answers，把 `🤔 待讨论` 标记替换为 `✅ 已确认`，把决策细节写回 `design.md`。

---

## 四、组合用法（实战场景）

### 场景 A：从 0 开始做一个新功能

```bash
# 1. 给 AI 喂业务和代码上下文（首次）
/ctx-design
/ctx-req

# 2. 创建 change
/opsx:new add-pronunciation-radar

# 3. 期间需要澄清需求？
/clarify ./prd-radar.md --change add-pronunciation-radar
# 用户回答 → 
/requirements-confirm --change add-pronunciation-radar

# 4. design 阶段有未定方案 → 回填
/design-confirm --change add-pronunciation-radar

# 5. 实现 + 验证 + 归档
/opsx:apply add-pronunciation-radar
/opsx:verify add-pronunciation-radar
/opsx:archive add-pronunciation-radar
```

### 场景 B：拿到一份大 PRD（多模块）

```bash
/split-clarify ./prd-v2.md --name-prefix spea
# 用户在可视化系统确认 split-plan →
/split-confirm openspec/split-plans/spea-split-20260605.json
# 现在有了多个 change，每个独立推进
```

### 场景 C：只是想写点 React 代码

```
直接告诉 AI："按 vercel-react-best-practices 的规范写一个 ScenarioPicker 组件"
```

---

## 五、文件目录速查

```
spea/
├── .claude/
│   ├── settings.json                       # Hooks（ESLint + Prettier 自动化）
│   ├── rules/ai-code-rules.md              # AI 代码生成硬规则
│   ├── commands/opsx/                      # OPSX 命令（10 个）
│   └── skills/                             # 18 个 skill
│
└── openspec/                               # OpenSpec 工作目录
    ├── config.yaml                         # 工作流配置（schema: trip-workflow）
    ├── schemas/trip-workflow/              # 工作流定义和模板
    ├── rules/                              # 澄清/拆分等规则
    ├── changes/                            # change 列表（含 archive/）
    ├── specs/                              # 主 spec（归档时合并入这里）
    ├── resources/                          # 原始需求文档
    └── split-plans/                        # 拆分计划 JSON
```

---

## 六、安装确认

```bash
openspec --version              # 应输出版本号（已确认 1.2.0）
openspec list                   # 列出当前 changes
```

如果命令不存在，安装：
```bash
npm install -g openspec
```

---

## 备注

- `openspec/changes/` 下当前有从 xtaro-tnt 项目迁移来的示例 change，这些是参考样本，可以保留观察 skill 输出格式，也可以删除。
- 所有 skill 的 description 中之前指向 xtaro-tnt 业务的字段已替换为 spea 项目的术语。
- `trip-workflow` 是 openspec schema 标识符（不是业务名），保留原样。
