<!-- AI-INSTRUCTIONS
⚠️ 你正在阅读项目开发上下文。在进行技术方案设计或代码实现时，你必须遵守以下规则。

## 加载协议

本知识库按重要性分层，请按以下顺序按需加载：

1. 先读完本文件（_index.md），获取架构概要和技术约束
2. 根据下方"任务快查表"，加载对应的维度文件
3. 核心层维度（architecture / reusable / dev-patterns）建议每次都加载
4. 按需层维度根据任务类型选择 1-2 个加载，不必全部读取

## 强制规则

1. 【架构遵守】代码必须放在正确的目录、使用正确的命名规范（查 architecture）
2. 【复用优先】如果已有工具函数/Hook/服务能满足需求，直接使用，不要重新实现（查 reusable）
3. 【模式遵循】新增代码时，按标准步骤操作，不得跳过任何环节（查 dev-patterns）
4. 【代码定位】修改已有功能时，先定位所有相关文件，评估影响范围（查 business-code）
5. 【横切接入】新增页面时，确保鉴权、错误处理、埋点等正确接入（查 cross-cutting）
6. 【避坑参考】不得重新提出已否决的方案，遇到 Workaround 先了解背景（查 decisions）

## 源码索引使用说明

本知识库中的文件路径和函数签名都是**源码索引**，而非示例代码。当你需要了解某个函数、组件或模式的具体实现时：
1. 直接 Read 索引指向的源码文件，获取真实的、最新的实现
2. 以真实代码为准进行模仿，而非凭记忆或猜测编写
3. 特别是"代码惯例"章节（dev-patterns 维度第 5 节），每种惯例都提供了参考文件路径，写新代码前务必先读取对应参考文件

## 校验清单

- [ ] 生成的代码不违反下方"核心技术约束速览"中的任何约束
- [ ] 没有重新实现 reusable 维度中已有的能力
- [ ] 新增文件遵循 architecture 维度的目录和命名约定
- [ ] 新增功能按 dev-patterns 维度的修改模式步骤操作

## 任务快查

| 你要做什么 | 建议加载的维度 |
|-----------|-------------|
| 新增页面/功能 | architecture, reusable, dev-patterns, cross-cutting |
| 修改已有功能 | architecture, reusable, dev-patterns, business-code, decisions |
| 修复 Bug | architecture, reusable, business-code, decisions |
| 新增 API 对接 | architecture, reusable, dev-patterns, business-code |
| 技术重构 | architecture, dev-patterns, business-code, decisions |

## 维度导航

- [核心] 架构与规范 → dimension-architecture.md
- [核心] 可复用能力 → dimension-reusable.md
- [核心] 开发模式 → dimension-dev-patterns.md
- [按需] 业务代码映射 → dimension-business-code.md
- [按需] 横切关注点 → dimension-cross-cutting.md
- [按需] 决策与经验 → dimension-decisions.md
-->

# 项目开发上下文

生成时间: {ISO 8601}
项目: {项目名称}
技术栈: {主要技术栈一句话}

---

## 1. 技术架构速览

**架构模式**: {分层/微服务/Monorepo/微前端 等}
**前端框架**: {框架 + 版本}
**语言**: {TypeScript/JavaScript + 版本}
**构建工具**: {webpack/vite/rollup 等}
**包管理**: {npm/yarn/pnpm}
**运行环境**: {浏览器/Node/多端 等}

**目录结构概要**:
```
{关键顶层目录结构，标注每个目录的职责}
```

## 2. 维度导航

| 层级 | 维度 | 文件 | 概要 |
|------|------|------|------|
| 核心 | 架构与规范 | `dimension-architecture.md` | {一句话概要} |
| 核心 | 可复用能力 | `dimension-reusable.md` | {一句话概要} |
| 核心 | 开发模式 | `dimension-dev-patterns.md` | {一句话概要} |
| 按需 | 业务代码映射 | `dimension-business-code.md` | {一句话概要} |
| 按需 | 横切关注点 | `dimension-cross-cutting.md` | {一句话概要} |
| 按需 | 决策与经验 | `dimension-decisions.md` | {一句话概要} |

## 3. 核心技术约束速览

<!-- PRIORITY: HIGH — 以下约束是硬性规定，所有方案和代码必须遵守 -->

| 约束 | 要求 | 来源 |
|------|------|------|
| {约束项} | {具体要求} | {配置文件/团队规范} |

## 4. 技术栈依赖全景

| 类别 | 依赖 | 版本 | 用途 |
|------|------|------|------|
| 框架 | {名称} | {版本} | {用途} |
| 状态管理 | {名称} | {版本} | {用途} |
| UI 库 | {名称} | {版本} | {用途} |
| 网络请求 | {名称} | {版本} | {用途} |
| 工具 | {名称} | {版本} | {用途} |
