---
name: split-plan-check
description: 检查拆分计划的完整性，验证所有源文件中的需求是否都已包含在拆分计划中。如有遗漏则补充回填到拆分计划。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 拆分计划完整性检查

检查指定的拆分计划文件，验证源文件中的所有需求是否都已包含在拆分计划中，如有遗漏则补充回填。

**命令**: `/split-plan-check <split-plan-file>`

**输入**:
- 拆分计划文件路径（必须是 `openspec/split-plans/` 目录下的 JSON 文件）

**输出**:
- 检查报告（包含完整性分析）
- 如有遗漏，自动补充并更新拆分计划文件

**特性**:
- 自动读取源文件（通过 metadata.sourceFiles）
- 智能识别需求条目
- 交叉比对验证
- 自动回填遗漏需求

---

## 命令用法

```bash
# 基础用法：检查指定的拆分计划文件
/split-plan-check openspec/split-plans/travel-log-redesign-split-20250324-travel-log.json

# 使用相对路径
/split-plan-check ./openspec/split-plans/myproject-split-20260324-feature.json
```

---

## 检查流程

### 1. 读取拆分计划

- 读取指定的 split-plan JSON 文件
- 验证文件格式是否符合模板规范
- 提取 `metadata.sourceFiles` 列表

### 2. 读取源文件

- 遍历 `metadata.sourceFiles` 中的所有文件
- 解析每个源文件中的需求条目
- 建立源文件需求索引

### 3. 比对分析

- 提取拆分计划中所有 groups 下的 requirements
- 与源文件需求进行交叉比对
- 识别遗漏的需求条目

### 4. 生成检查报告

输出格式：

```
✅ 拆分计划完整性检查报告

文件: openspec/split-plans/xxx-split-xxx.json
源文件数: 2
总需求数: 15
已覆盖: 15
遗漏: 0

状态: 完整 ✓
```

或者：

```
⚠️ 拆分计划完整性检查报告

文件: openspec/split-plans/xxx-split-xxx.json
源文件数: 2
总需求数: 18
已覆盖: 15
遗漏: 3

遗漏的需求：
1. [源文件: prd.md, 章节: 三、技术方案]
   需求描述: 使用 Redis 缓存用户会话数据...

2. [源文件: prd.md, 章节: 四、性能要求]
   需求描述: 页面加载时间不超过 2 秒...

3. [源文件: design.md, 章节: API 设计]
   需求描述: 提供 RESTful API 接口...

状态: 不完整 ✗
```

### 5. 自动回填（如有遗漏）

- 分析遗漏需求的特征（技术/业务/范围维度）
- 智能分配到最合适的 group（基于维度相似度）
- 或创建新的 group（如果遗漏需求无法归入现有组）
- 更新拆分计划文件
- 生成回填报告

回填后输出：

```
✅ 已补充遗漏需求并更新拆分计划

补充详情：
1. REQ-23: 使用 Redis 缓存用户会话数据
   → 已添加到 RG-2 (数据存储模块)

2. REQ-24: 页面加载时间不超过 2 秒
   → 已添加到 RG-1 (性能优化模块)

3. REQ-25: 提供 RESTful API 接口
   → 创建新组 RG-5 (API 接口层)

更新后的拆分计划已保存到原文件。
```

---

## 需求识别规则

### 识别信号

从源文件中识别需求时，查找以下信号：

1. **章节标题**：
   - 包含 "需求"、"功能"、"特性"、"模块"、"页面"、"交互"、"数据"、"接口" 等关键词

2. **列表项**：
   - 有序列表（1. 2. 3. ）
   - 无序列表（- * ）
   - 带编号的段落

3. **明确的需求描述**：
   - 包含 "需要"、"应该"、"必须"、"要求"、"实现"、"提供"、"支持" 等动词
   - 包含明确的主体、动作、对象

4. **技术规格**：
   - API 定义
   - 数据结构
   - 性能指标
   - 约束条件

### 排除项

以下内容不视为需求：
- 纯背景说明
- 项目概述
- 版本历史
- 参考资料
- 附录内容

---

## 分组分配策略

遗漏需求的分组分配遵循以下优先级：

### 1. 相似度匹配（优先）

- 计算遗漏需求与各 group 现有需求的相似度
- 相似度维度：
  - 技术栈相似度（30%）
  - 业务领域相似度（30%）
  - 功能范围相似度（40%）
- 阈值：相似度 ≥ 0.5 则分配到该组

### 2. 维度匹配（次选）

- 如果相似度匹配失败，使用维度匹配
- 根据 group 的 `splitReason.primaryDimension` 判断
- 维度类型：
  - `technical`: 技术实现相关
  - `scope`: 功能范围相关
  - `business`: 业务场景相关

### 3. 创建新组（兜底）

- 如果以上两种方式都无法匹配（相似度 < 0.5）
- 创建新的 group
- 自动生成 group 的 id、name、changeName、description
- 保持 `splitReason` 一致性

---

## 输出更新规则

### 更新拆分计划时的注意事项

1. **保持结构完整性**：
   - 不修改 metadata（除了 totalRequirements）
   - 不修改现有 groups 的基本信息
   - 只在 groups[].requirements 数组中追加

2. **ID 连续性**：
   - 新需求 ID 从现有最大 REQ-N 继续编号
   - 新 group ID 从现有最大 RG-N 继续编号

3. **依赖关系**：
   - 新添加的 requirements 暂不设置依赖关系
   - 新创建的 group 可能依赖现有 group（根据业务逻辑判断）

4. **原子性**：
   - 先备份原文件（添加 .backup 后缀）
   - 验证 JSON 格式正确后再写入
   - 写入失败则从备份恢复

---

## 错误处理

### 文件不存在

```
❌ 错误: 拆分计划文件不存在
路径: openspec/split-plans/xxx.json

请检查文件路径是否正确。
```

### 源文件缺失

```
⚠️ 警告: 部分源文件无法读取

metadata.sourceFiles 中的文件:
- ✓ openspec/resources/prd-v1.md
- ✗ openspec/resources/design.md (文件不存在)

将基于可用文件进行检查。
```

### JSON 格式错误

```
❌ 错误: 拆分计划文件格式不正确
路径: openspec/split-plans/xxx.json

JSON 解析失败: Unexpected token } at position 1234

请检查文件格式是否符合模板规范。
```

---

## 执行示例

### 示例 1: 完整覆盖

```bash
/split-plan-check openspec/split-plans/myproject-split-20260324-feature.json
```

输出：
```
✅ 拆分计划完整性检查报告

文件: openspec/split-plans/myproject-split-20260324-feature.json
源文件数: 1
源文件: openspec/resources/myproject/prd-v1.md
总需求数: 12
已覆盖: 12
遗漏: 0

状态: 完整 ✓

所有源文件中的需求都已包含在拆分计划中。
```

### 示例 2: 有遗漏并自动补充

```bash
/split-plan-check openspec/split-plans/travel-log-redesign-split-20250324-travel-log.json
```

输出：
```
⚠️ 拆分计划完整性检查报告

文件: openspec/split-plans/travel-log-redesign-split-20250324-travel-log.json
源文件数: 1
源文件: openspec/resources/travel-log-redesign/requirements/WSX5d8jIOovSdKx4rRScHEd6nrb.md
总需求数: 25
已覆盖: 22
遗漏: 3

遗漏的需求：
1. [章节: 三、背景与目标 - 性能要求]
   描述: 页面首屏加载时间不超过 2 秒，地图渲染时间不超过 1 秒

2. [章节: 四、需求内容 - 数据缓存]
   描述: 用户旅行数据需要缓存 24 小时，减少接口调用

3. [章节: 六、埋点需求 - 错误日志]
   描述: 记录所有接口错误和前端异常，用于监控和排查

---

正在分析遗漏需求归属...

REQ-23: 页面首屏加载时间不超过 2 秒
  → 相似度分析: RG-1 (0.62), RG-2 (0.35), RG-3 (0.28), RG-4 (0.15)
  → 分配到: RG-1 (页面UI展示模块)

REQ-24: 用户旅行数据需要缓存 24 小时
  → 相似度分析: RG-1 (0.48), RG-2 (0.55), RG-3 (0.32), RG-4 (0.25)
  → 分配到: RG-2 (地图功能模块)

REQ-25: 记录所有接口错误和前端异常
  → 相似度分析: RG-1 (0.25), RG-2 (0.18), RG-3 (0.22), RG-4 (0.72)
  → 分配到: RG-4 (翻译埋点与实验)

---

✅ 已补充遗漏需求并更新拆分计划

补充详情：
- RG-1: 新增 1 条需求（现有 17 条）
- RG-2: 新增 1 条需求（现有 2 条）
- RG-4: 新增 1 条需求（现有 4 条）

备份文件: openspec/split-plans/travel-log-redesign-split-20250324-travel-log.json.backup
更新后的拆分计划已保存到原文件。
```

---

## 集成说明

### 与其他 skills 的关系

```
/split-clarify              # 生成拆分计划
    ↓
/split-plan-check         # 检查完整性（本 skill）
    ↓
/split-confirm              # 确认拆分方案并创建 changes
```

### 推荐工作流

1. 运行 `/split-clarify` 生成拆分计划
2. **运行 `/split-plan-check` 验证完整性**（新增步骤）
3. 如有遗漏，自动补充后重新检查
4. 确认无误后，运行 `/split-confirm` 创建 changes

---

## 注意事项

1. **不修改 metadata.status**：
   - 即使补充了需求，也不改变 status（由 /split-confirm 管理）

2. **不影响用户确认流程**：
   - 补充需求后，用户仍需通过可视化系统确认拆分方案

3. **备份机制**：
   - 每次修改都会创建 .backup 文件
   - 手动恢复：`cp xxx.json.backup xxx.json`

4. **幂等性**：
   - 多次运行不会重复添加相同需求
   - 基于需求内容的相似度去重（阈值 0.9）

5. **大文件处理**：
   - 源文件超过 1000 行时，分段读取
   - 拆分计划超过 100 个需求时，分段更新

---

## 规则文件引用

执行检查时会参考以下规则文件：

- `openspec/rules/splitting.md` - 拆分规则（用于理解分组逻辑）
- `openspec/rules/requirement-coverage.md` - 需求覆盖率验证规则
- `openspec/schemas/trip-workflow/templates/requirement-split-plan.json` - 拆分计划模板

---

## 常见问题

### Q1: 如何判断两个需求是否相同？

A: 使用多维度相似度计算：
- 文本相似度（TF-IDF + 余弦相似度）≥ 0.9
- 关键词重叠度 ≥ 0.8
- 出现位置接近（同一章节）

### Q2: 如果源文件已更新怎么办？

A: 建议：
1. 重新运行 `/split-clarify` 生成新的拆分计划
2. 或手动更新 metadata.sourceFiles 后运行本 skill

### Q3: 补充的需求会自动生成澄清问题吗？

A: 不会。本 skill 只负责完整性检查和需求补充。澄清问题由 `/split-confirm` 生成。

### Q4: 能否只检查不补充？

A: 当前版本会自动补充。如需只检查不补充，可在运行前说明：
```bash
# 告诉 Claude 只检查不补充
只检查不补充：/split-plan-check xxx.json
```

---

## 版本历史

- v1.0 (2026-03-24): 初始版本
  - 支持完整性检查
  - 支持自动补充遗漏需求
  - 支持智能分组分配
