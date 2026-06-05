# CLAUDE.md - AI 英语口语陪练工具

> 这是一个 AI 英语口语陪练工具的技术工程，基于 Node.js + WebSocket 构建。

---

## 项目概述

**spea** 是一个实时语音对话练习应用，用户可以在特定场景（面试、点餐、会议等）中进行 AI 陪练，获得发音评测、语法纠正和课后报告。

---

## 技术架构

```
spea/
├── server/           # Node.js WebSocket 后端
│   └── src/
│       ├── main.ts               # 入口
│       ├── gateway/ws-gateway.ts # WebSocket 网关
│       ├── lib/llm-client.ts    # LLM 客户端
│       └── modules/              # 业务服务
│           ├── dialog.service.ts     # 对话服务
│           ├── correction.service.ts # 纠错服务
│           ├── report.service.ts    # 报告服务
│           ├── asr.service.ts       # 语音识别
│           ├── tts.service.ts       # 语音合成
│           └── pronunciation.service.ts # 发音评测
├── web/              # 前端（Vite + TypeScript）
│   └── src/
│       ├── ws-client/   # WebSocket 客户端
│       ├── audio/       # 音频采集与播放
│       └── store/       # 状态管理
├── shared/           # 前后端共享类型
│   └── contracts.ts   # WebSocket 消息契约
├── specs/            # 技术方案文档
└── .claude/          # Claude Code Harness 配置
    ├── settings.json     # Hooks 配置
    ├── rules/            # 代码规则
    ├── skills/           # 技能集（含 OpenSpec 工作流技能）
    └── commands/         # OPSX 命令集
```

---

## Harness 配置

### hooks
- **PostToolUse**: Write/Edit 后自动运行 ESLint + Prettier
- **Stop**: 停止前校验新文件风格是否与同目录已有文件对齐

### rules
- `ai-code-rules.md` — AI 代码生成规则（必须遵守）

### skills
| 技能 | 用途 |
|------|------|
| `project-context-design` | 生成项目开发上下文文档 |
| `project-context-requirements` | 生成项目需求上下文 |
| `requirements-clarify` | 需求澄清 |
| `requirements-confirm` | 需求确认 |
| `split-clarify` | 分阶段澄清 |
| `split-confirm` | 分阶段确认 |
| `split-plan-check` | 分阶段计划检查 |
| `design-confirm` | 设计确认 |
| `vercel-react-best-practices` | React 最佳实践 |
| `openspec-*` 系列 | OpenSpec 工作流（需安装 openspec CLI） |

### commands (OPSX 工作流)
| 命令 | 用途 |
|------|------|
| `/opsx:verify` | 验证实现与变更工件匹配 |
| `/opsx:new` | 创建新变更 |
| `/opsx:continue` | 继续变更实现 |
| `/opsx:archive` | 归档变更 |
| `/opsx:ff` | 快进变更 |
| `/opsx:onboard` | OpenSpec 引导入门 |
| `/opsx:sync` | 同步规格 |
| `/opsx:apply` | 应用变更 |
| `/opsx:explore` | 探索模式 |

---

## 开发规范

### 代码规范
- 使用 TypeScript，严格类型检查
- 使用 ESLint + Prettier 做代码格式化
- 禁止 `any`，使用 `unknown` 代替
- 所有异步操作必须 `try/catch`
- 使用 `async/await`，不使用 `.then().catch()`

### 目录规范
- 目录名：`kebab-case`
- 组件文件：`PascalCase`（React）或 `kebab-case`
- 测试文件：`*.test.ts`

### 导入排序（5 组）
1. Node 内置模块
2. 第三方库
3. 项目绝对路径（@/）
4. 相对路径（../）
5. 当前目录（./）

---

## 相关文档

- `英语口语陪练-技术方案.md` — 详细技术方案
- `.claude/rules/ai-code-rules.md` — 代码生成规则