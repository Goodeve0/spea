---
name: project-context-design
alias: ctx-design
description: |
  项目开发上下文生成工具。
  扫描项目代码库，生成结构化的开发知识文档（索引 + 维度拆分），
  帮助 AI 深度理解项目的技术架构、开发模式、业务代码映射和横切关注点，
  从而生成与项目风格一致的技术方案和代码，最大化复用已有能力。

  **用法**:
  - `/ctx-design` 或 `/project-context-design` - 生成开发上下文（索引 + 维度文件）
  - `/ctx-design --update` - 强制重新生成全部文件
  - `/ctx-design --dimension <name>` - 只更新指定维度文件

  **输出目录**: `openspec/project-context-design/`
license: MIT
metadata:
  author: openspec
  version: "3.0"
---

Base directory for this skill: {{SKILL_DIR}}

项目开发上下文生成工具。扫描项目代码库，采用"核心层 + 按需层"的双层维度结构生成开发知识文档，确保 AI 生成的方案和代码与项目风格一致、最大化复用已有能力。

**命令**: `/ctx-design` 或 `/project-context-design`

**参数**:
- `--update` - 强制重新生成全部文件
- `--dimension <name>` - 只更新指定维度文件

**输出目录**: `openspec/project-context-design/`

### 工具调用约束（Read / trip-workflow 大文件）

执行本 skill 扫描 OpenSpec 时：

- `openspec/schemas/trip-workflow/schema.yaml` 常超过 **Read 单次约 10000 token** 上限。**禁止**不带 `offset`/`limit` 的整文件 Read。
- 需要工作流配置时：优先读 `openspec/config.yaml`（短小）。若必须读 `schema.yaml`，使用 **Read** 且 **`offset` 与 `limit` 均为正整数**（例如 `offset: 1, limit: 200` 分段续读），**禁止** `limit: -1`、负数或 0。
- 可用 **Bash** 的 `wc -l`、`head -n` / `tail -n` 再分段 Read。
- 开发上下文生成**不依赖** schema 全文；能由 `config.yaml` 与目录结构推断时，无需读完整个 `schema.yaml`。

---

## 核心定位

生成一份 **AI Agent 的开发操作手册 + 技术导航地图**，帮助消费者解决以下问题：

| AI 遇到的问题 | 需要的知识 | 对应维度 |
|---|---|---|
| 不知道项目技术栈和架构 | 框架、目录结构、编码规范 | architecture |
| 写的代码风格与项目不一致 | 命名、缩进、import 规则 | architecture |
| 不知道有哪些现成的轮子 | 工具函数/Hook/组件/服务 | reusable |
| 新增功能不知道标准步骤 | 修改模式、代码惯例骨架 | dev-patterns |
| 对接 API 格式不一致 | 响应格式、分页、错误码 | dev-patterns |
| 不知道业务代码在哪 | 概念→文件映射 | business-code |
| 修改共享类型遗漏下游 | 模块依赖、变更影响 | business-code |
| 忘记接入鉴权/埋点/错误处理 | 横切能力接入方式 | cross-cutting |
| 踩了已知的坑 | 历史决策、Workaround | decisions |
| 硬编码配置或暴露敏感信息 | 环境变量、配置安全规范 | architecture |

这张表帮助生成时判断 **每个维度应覆盖什么内容**，确保输出文档能解决对应问题。

---

## 维度与输出约束

6 大维度分为核心层和按需层，**生成时核心层优先、内容更精炼**，按需层允许更详细。

### 项目规模判定

生成前先扫描项目源文件数量，确定规模等级和对应的行数系数。

**统计范围**: `src/` 目录下匹配 `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.vue`, `*.svelte` 的文件（排除 `node_modules/`, `dist/`, `build/`, `*.test.*`, `*.spec.*`, `__tests__/`）。monorepo 项目统计所有 packages 的 `src/` 总和。

| 规模等级 | 源文件数 | 行数系数 | 说明 |
|---------|---------|---------|------|
| S（小型） | < 50 | — | 全部维度合并到 `_index.md`，不生成独立维度文件 |
| M（中型） | 50 – 200 | ×1.0 | 使用基准行数上限 |
| L（大型） | 200 – 500 | ×1.5 | 基准上限 × 1.5 |
| XL（超大型）| > 500 | ×2.0 | 基准上限 × 2.0 |

生成时在 `_index.md` 的 AI-INSTRUCTIONS 区块中记录实际判定的规模等级和源文件数量。

### 核心层（高频使用，生成时优先保证质量、严控篇幅）

| 维度 | 文件 | 生成重点 | 基准行数上限 |
|------|------|---------|-----------|
| 架构与规范 | `dimension-architecture.md` | 目录约定、命名规范、编码风格、环境配置 | 400 行 |
| 可复用能力 | `dimension-reusable.md` | 函数/Hook/组件/服务的签名和用途 | 400 行 |
| 开发模式 | `dimension-dev-patterns.md` | 修改模式步骤、API 契约、代码惯例骨架 | 400 行 |

**核心层总量控制**: `_index.md`(基准 200 行) + 3 个核心维度(基准 1200 行) = **基准 ≤ 1400 行**，实际上限 = 基准 × 行数系数

### 按需层（特定场景使用，允许更详细）

| 维度 | 文件 | 生成重点 | 基准行数上限 |
|------|------|---------|-----------|
| 业务代码映射 | `dimension-business-code.md` | 概念→文件映射、模块依赖、实体关系 | 400 行 |
| 横切关注点 | `dimension-cross-cutting.md` | 鉴权/错误处理/埋点的接入方式 | 400 行 |
| 决策与经验 | `dimension-decisions.md` | 历史决策、已知坑点、技术债务 | 300 行 |

**各规模实际上限速查**:

| 文件 | M (×1.0) | L (×1.5) | XL (×2.0) |
|------|----------|----------|-----------|
| `_index.md` | 200 行 | 300 行 | 400 行 |
| 核心层维度（每个） | 400 行 | 600 行 | 800 行 |
| 按需层维度（每个） | 400 行 | 600 行 | 800 行 |
| `dimension-decisions.md` | 300 行 | 450 行 | 600 行 |
| **全部文件总计** | ≤ 2500 行 | ≤ 3750 行 | ≤ 5000 行 |

---

## 输出文件结构

```
openspec/project-context-design/
├── _index.md                       # 索引：AI 指令 + 架构概要 + 维度导航 + 任务快查
├── dimension-architecture.md       # [核心] 架构与规范
├── dimension-reusable.md           # [核心] 可复用能力
├── dimension-dev-patterns.md       # [核心] 开发模式
├── dimension-business-code.md      # [按需] 业务代码映射
├── dimension-cross-cutting.md      # [按需] 横切关注点
└── dimension-decisions.md          # [按需] 决策与经验
```

---

## 输出结构规范

以下规则指导 **生成时** 如何组织输出内容，使文档对消费者友好。

**指令区前置**: 每个输出文件开头放 `<!-- AI-INSTRUCTIONS -->` 区块，用指令性语言概括该文件的核心价值、使用方式和关键规则。消费者的使用约束（如分层加载、任务快查表）写在 `_index.md` 的 AI-INSTRUCTIONS 中，而非本 skill 中。

**信息密度控制**:
- 各文件行数上限 = 基准行数 × 项目规模对应的行数系数（见"项目规模判定"）
- 无论规模大小，始终优先保证信息密度，行数系数提升的是上限而非目标值
- 超出上限时按复用频率/影响范围裁剪低优先级内容，并在文件末尾添加裁剪说明：`<!-- TRUNCATED: 因行数限制，N 个低优先级条目未列出。可通过 --dimension <name> --verbose 查看完整版 -->`
- 关键章节用 `<!-- PRIORITY: HIGH/MEDIUM/LOW -->` 标记

**关键信息重复**: 最重要的技术约束同时出现在 `_index.md` 和对应维度文件中，确保消费者无论从哪个入口读取都能看到关键约束。

---

## 执行流程

### 1. 检查知识库目录是否存在

检查固定路径：
```
openspec/project-context-design/_index.md
```

### 2. 如果存在且无 `--update` / `--dimension` 参数

直接读取 `_index.md` 并返回，结束执行。

### 3. 如果不存在或有 `--update` 参数

**3a. 判定项目规模**

统计 `src/` 下的源文件数量（规则见"项目规模判定"），确定规模等级（S / M / L / XL）和行数系数。若为 S 级项目，直接生成合并版 `_index.md` 后结束。

**3b. 按顺序逐维度扫描并生成**（后面的维度可引用前面的结果）：

1. 扫描 3.1 架构与规范 → 生成 `dimension-architecture.md`
2. 扫描 3.2 可复用能力 → 生成 `dimension-reusable.md`
3. 扫描 3.3 业务代码映射 → 生成 `dimension-business-code.md`
4. 扫描 3.4 开发模式 → 生成 `dimension-dev-patterns.md`
5. 扫描 3.5 横切关注点 → 生成 `dimension-cross-cutting.md`
6. 扫描 3.6 决策与经验 → 生成 `dimension-decisions.md`
7. 汇总生成 `_index.md`（在 AI-INSTRUCTIONS 中记录规模等级和源文件数）

对每个维度，评估是否有实质内容：
- **有内容** → 生成对应文件（行数不超过 基准上限 × 行数系数），并在 `_index.md` 中列出
- **超出上限** → 按优先级裁剪低频内容，文件末尾添加 `<!-- TRUNCATED -->` 说明
- **无内容** → 跳过，不生成该维度文件

### 4. 如果有 `--dimension <name>` 参数

只重新扫描指定维度，更新对应的 `dimension-{name}.md`。

---

## 项目扫描流程

### 扫描排除规则

扫描项目文件时，**必须排除以下目录**：

- `openspec/` - OpenSpec 规格和变更目录，避免扫描生成的规格文档
- `node_modules/` - 依赖包目录
- `dist/`, `build/`, `.next/`, `out/` - 构建输出目录
- `.git/`, `.svn/` - 版本控制目录
- `coverage/`, `.nyc_output/` - 测试覆盖率输出
- `__tests__/`, `*.test.*`, `*.spec.*` - 测试文件（测试模式已在开发模式维度体现，无需重复扫描源码）

**扫描范围**: 只扫描项目源代码、配置文件和开发相关文档，不扫描生成的规格文档、依赖包和构建产物。

**统计范围**（判定项目规模时）: `src/` 目录下匹配 `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.vue`, `*.svelte` 的文件，排除上述目录和测试文件。

每个维度的模板文件位于 `{{SKILL_DIR}}/templates/` 目录下，生成时读取对应模板。

### 3.1 扫描架构与规范（→ `dimension-architecture.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-architecture.tpl.md`

**技术栈识别**:
- 读取 `package.json` / `tsconfig.json` / 构建配置，识别框架、语言、版本
- 分析 monorepo 结构（lerna.json / pnpm-workspace.yaml / nx.json）
- 识别构建工具链（webpack/vite/rollup/turbopack）

**目录结构约定**:
- 扫描 `src/` 下的目录结构，识别分层模式
- 提取目录命名规律（pages vs views, components, hooks, services, store 等）
- 识别文件命名约定（kebab-case/camelCase/PascalCase + 后缀惯例）

**编码规范提取**:
- 读取 ESLint / Prettier / StyleLint 配置，提取关键规则
- 读取 TypeScript 配置，提取 strict 模式和路径别名
- 扫描已有代码，提取 import 排序规则、导出模式

**环境与配置管理**:
- 扫描 `.env*` 文件体系，识别环境变量命名规范和分环境策略
- 区分构建时注入（如 `VITE_*`/`NEXT_PUBLIC_*`）和运行时读取方式
- 识别特性开关（Feature Flags）方案和使用方式
- 检查敏感配置处理规范（哪些不可出现在前端代码中）

**技术约束识别**:
- CI/CD 配置（构建流程、质量门禁）
- 性能预算（bundle size 限制、lighthouse 配置）
- 安全策略（CSP、CORS、依赖审计）
- 兼容性要求（浏览器/Node/平台版本）

### 3.2 扫描可复用能力（→ `dimension-reusable.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-reusable.tpl.md`

**扫描目录**:
- 通用工具：`utils/`, `helpers/`, `lib/`, `shared/`
- 自定义 Hooks：`hooks/`, `composables/`
- 服务封装：`services/`, `api/`
- UI 组件：`components/`（区分通用 vs 业务组件）
- 中间件/拦截器：`middleware/`, `interceptors/`
- 高阶组件/装饰器：`hoc/`, `decorators/`

**对每个能力提取**:
- 函数/类签名（参数类型 → 返回值类型）
- 使用场景说明（从 JSDoc / 注释 / 命名推断）
- 被引用次数（评估复用度，标记高频 / 低频）
- 调用示例（从已有代码中提取一个典型用法）

### 3.3 扫描业务代码映射（→ `dimension-business-code.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-business-code.tpl.md`

**业务概念→代码定位**:
- 从路由配置、页面目录结构、API 目录结构推断业务模块划分
- 对每个业务概念/模块，映射到所有相关文件（页面、组件、Hook、服务、类型、Store、测试）
- 整理为"概念→文件集合"的映射表

**领域模型关系**:
- 扫描类型定义文件（`types/`, `models/`, `interfaces/`）
- 提取核心实体间的关系，生成实体关系概览（Mermaid ER 图）

**模块依赖关系与变更影响**:
- 分析模块间的 import 依赖方向，识别分层约束
- 提取跨模块共享的类型/接口/函数，标记为"高影响变更点"
- 对每个高影响变更点，列出所有下游消费者

**关键数据结构**:
- 提取 API 请求/响应类型、Store 状态结构
- 标记跨模块共享的类型

### 3.4 扫描开发模式（→ `dimension-dev-patterns.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-dev-patterns.tpl.md`

**修改模式提取（操作手册）**:
- 归纳"创建新 XX"的标准步骤，覆盖：新增页面/路由、新增 API 接口对接、新增业务组件、新增工具函数/Hook、新增 Store 模块
- 对每个场景给出：步骤列表、参考文件、关键注意点

**API 契约规范**:
- 提取统一的 API 响应包装格式、分页参数规范、错误码体系
- 识别 API Mock 方案和前后端类型同步方式

**数据流追踪**:
- 选取 2-3 个典型功能，追踪完整链路并标注文件位置

**状态管理地图**:
- 识别状态管理方案，提取 Store 结构概览
- 总结全局 vs 局部状态判断标准和缓存策略

**代码惯例模式**:
- 提取组件、Hook、服务层、测试的典型结构骨架

### 3.5 扫描横切关注点（→ `dimension-cross-cutting.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-cross-cutting.tpl.md`

**鉴权/权限**: 登录态获取、权限校验层级、相关文件位置
**错误处理**: 全局捕获机制、统一错误格式、用户提示方式
**监控/埋点/日志**: SDK、标准埋点参数、接入方式
**国际化**（如有）: i18n 方案、文案组织、新增步骤
**样式方案**: 技术选择、主题变量、多端适配
**副作用地图**: HTTP 拦截器、路由守卫、全局事件

### 3.6 扫描决策与经验（→ `dimension-decisions.md`）

**模板**: `{{SKILL_DIR}}/templates/dimension-decisions.tpl.md`

**历史技术决策**: 从 `openspec/changes/*/design.md` 提取决策记录
**已知坑和 Workaround**: 扫描 `TODO`/`FIXME`/`HACK`/`@ts-ignore` 等标记
**技术债务**: 过时依赖、临时方案、性能瓶颈
**平台差异**（多端项目适用）: 平台特殊处理、条件编译策略

---

## 护栏

- **目录位置固定** - 必须存储在 `openspec/project-context-design/`
- **规模先行** - 生成前必须先判定项目规模等级（S / M / L / XL），并据此确定各文件行数上限
- **动态行数上限** - 各维度文件实际行数上限 = 基准上限 × 规模对应的行数系数（M ×1.0 / L ×1.5 / XL ×2.0）
- **核心层精炼** - 核心层（architecture / reusable / dev-patterns）生成时优先保证质量，核心层总量 ≤ 基准 1400 行 × 行数系数
- **按需层限制** - 按需层（business-code / cross-cutting / decisions）使用各自基准上限 × 行数系数
- **溢出裁剪** - 超出行数上限时按复用频率/影响范围裁剪低优先级内容，文件末尾添加 `<!-- TRUNCATED -->` 说明裁剪数量和范围
- **按需生成** - 扫描后无实质内容的维度不生成文件，`_index.md` 中也不列出
- **顺序依赖** - 按 architecture → reusable → business-code → dev-patterns → cross-cutting → decisions 顺序执行，后面的维度可引用前面的结果
- **模板外置** - 维度模板存储在 `{{SKILL_DIR}}/templates/`，执行时按需读取当前维度模板
- **AI 指令前置** - 每个输出文件必须以 `<!-- AI-INSTRUCTIONS -->` 开头
- **规模记录** - `_index.md` 的 AI-INSTRUCTIONS 中必须记录项目规模等级、源文件数量和使用的行数系数
- **优先级标记** - 关键章节用 `<!-- PRIORITY: HIGH -->` 标记
- **代码骨架非源码** - 代码惯例模式提供结构骨架，不复制完整源码
- **条件生成** - 带"生成条件"注释的章节，无实质内容时整节省略
- **增量更新** - 支持 `--dimension` 参数只更新单个维度
- **非阻塞** - 扫描失败不中断流程
- **只读分析** - 不修改任何项目文件
- **小项目兼容** - S 级项目（< 50 个源文件），将全部维度合并到 `_index.md` 中，不生成独立维度文件
