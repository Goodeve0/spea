# AI 代码生成规则（Agent 版）

> 你在编写和修改代码时必须遵守以下所有规则。违反任何一条都可能导致编译失败、运行时错误或代码质量问题。

---

## 一、修改已有代码前

1. **先读再改**：修改任何文件前，先用工具读取该文件完整内容。不得凭记忆或假设直接输出修改。文件超过 500 行时逐段读取，确认修改目标的具体行号。

2. **同步所有引用**：修改类型定义、枚举、常量时，必须在同一次操作中同步修改所有引用处。逐文件输出改动，标注文件路径和行号，不得遗漏。

3. **限定修改范围**：先确定完整调用链路（入口 → 中间层 → 最终副作用），只修改链路上的节点。禁止修改链路以外的代码。多条链路可能涉及时，选最小范围的那条。

---

## 二、新增代码前

4. **复用优先**：生成工具函数、API 调用或组件前，先检索项目中是否已有相似实现。存在功能重叠的代码时必须复用，禁止新建重复实现。扩展已有函数时：
   - 仅被当前目标引用 → 可直接修改
   - 存在其他引用 → 通过新增可选参数扩展，默认值保持原有行为不变，禁止修改已有参数含义

5. **声明模块边界**：生成新功能前先说明模块划分，再输出代码。遵循以下拆分规则：
   - 禁止在 .tsx 中编写业务逻辑和数据请求
   - 禁止行内 `style={{}}`（动态值除外），样式抽到 CSS Modules
   - 超过 3 个类型定义 → 抽到 `types.ts`
   - 超过 3 个常量 → 抽到 `constants.ts`
   - 单文件不超过 400 行，组件文件不超过 200 行

6. **控制粒度**：不为单次使用的逻辑创建抽象类/工厂函数。不引入不必要的设计模式。不创建超过 2 层的继承结构。不省略错误处理。不使用魔法数字。

7. **新建文件风格对齐**：新建任何代码/测试文件前，必须先读取同目录至少 1-2 个现有文件，对齐该目录的实际风格后再输出，包括但不限于缩进、引号、import 分组与排序、空行、导出写法、测试写法。若目录实际风格与通用默认格式冲突，以同目录现有文件为准，不得使用模型默认格式自行发挥。

8. **AI 临时测试文件不保留**：若为了本次会话临时验证而新建测试文件、脚本或样例文件，默认视为临时产物，不得作为最终变更保留或提交。只有在用户明确要求保留测试，或该测试确实属于长期有效的正式回归覆盖时，才允许留下；否则验证完成后必须删除。

---

## 三、编写代码时

7. **组件声明顺序**（固定，不得打乱）：
   ① Context/Router hooks → ② Store/全局状态 → ③ useState → ④ useMemo/useCallback → ⑤ useEffect → ⑥ handle* 事件处理 → ⑦ render* 渲染函数 → ⑧ JSX return

8. **useEffect 约束**：每个 useEffect 只处理一种副作用。同一组件不超过 3 个，超出提取到自定义 Hook。必须声明依赖数组。需清理的副作用必须返回清理函数。

9. **可读性约束**：
   - 禁止 `eval`、`new Function`（除非只能使用这种方式实现）
   - 禁止 `function*`、`Proxy`、`Reflect`（除非框架底层需求）
   - 禁止超过 2 层的三元嵌套
   - 赋值右侧最多嵌套 1 层函数调用，超过必须拆中间变量
   - 调用链最多连续 3 个，超过必须拆中间变量
   - 优先 `async/await`，不用 `.then().catch()` 链
   - 优先具名函数，不用复杂匿名箭头函数

10. **文件命名**：默认 `kebab-case`。若项目组件文件用 PascalCase 则遵循项目约定。目录名一律 `kebab-case`。生成调用代码前先检查项目中同类功能的已有调用方式（静态方法 vs 命名导出），禁止混用。

11. **import 排序**（5 组，组间空行，组内字母序）：
    ① Node 内置模块 → ② 第三方库 → ③ 项目绝对路径（@/） → ④ 相对路径（../） → ⑤ 当前目录（./）
    默认导出在前，具名导出字母序，`import type` 在值导入之后。

12. **代码格式**：2 空格缩进，单引号（JSX 双引号），必须加分号，多行尾随逗号，LF 行尾，最大行长 120。

---

## 四、代码输出后自检

13. **编译完整性**（每次输出代码后必须逐项检查）：
    - 所有引用的变量、函数、类型是否已 import 或已在当前作用域定义
    - 禁止 `any`，用明确类型或 `unknown`
    - 泛型参数不可省略
    - 类型断言 `as` 必须附注释说明原因
    - 公共函数必须有返回类型声明
    - 类型引用用 `import type`，不混入值导入
    - 禁止 `var`，用 `const`/`let`，优先 `const`
    - 用 `===` 不用 `==`
    - 无重复导入，无未使用的导入

14. **边界条件与异常处理**：
    - 所有异步操作必须 `try/catch`，catch 块不得为空
    - 数组操作前校验非空或用可选链
    - 对象属性访问超过 2 层用 `?.`
    - 公共函数必须有参数校验
    - 必须处理：网络请求失败、null/undefined、空数组、异步竞态、组件卸载后回调

15. **日志**：
    - catch 块、业务校验失败、异常状态变化 → 必须加日志
    - 格式：`console.error('[模块名.函数名] 描述:', 关键参数, error)`
    - 只用 `console.error` 和 `console.warn`，禁止 `console.log`
    - 日志必须包含关键参数值，禁止只写 `'error'` 或 `'failed'`

16. **算法效率**：
    - 禁止嵌套循环（O(n²)），用 Map/Set 优化到 O(n)
    - 禁止同一数组多次串行遍历（filter+map），合并为一次
    - 循环体内不变的计算提到循环外
    - 数据量 > 1000 条时禁止线性查找，用 Map/Set 索引

---

## 关键示例

**复用扩展（规则 4）**：
```typescript
// ❌ 存在其他引用时直接改参数
function formatDate(date: Date, type: 'old' | 'new') { ... }

// ✅ 新增可选参数，原有行为不变
function formatDate(date: Date, options?: { withTime?: boolean }): string {
  const base = date.toLocaleDateString();
  if (options?.withTime) return `${base} ${date.toLocaleTimeString()}`;
  return base;
}
```

**异常处理 + 日志（规则 14、15）**：
```typescript
async function fetchUser(id: string): Promise<User | null> {
  if (!id) return null;
  try {
    const res = await api.getUser(id);
    return res.data ?? null;
  } catch (error) {
    console.error('[fetchUser] failed, id:', id, error);
    return null;
  }
}
```

**算法优化（规则 16）**：
```typescript
// ❌ O(n²)
const result = listA.filter(a => listB.some(b => b.id === a.id));

// ✅ O(n)
const setB = new Set(listB.map(b => b.id));
const result = listA.filter(a => setB.has(a.id));
```

**嵌套调用拆分（规则 9）**：
```typescript
// ❌
setActiveKey(getActiveKey(pathname));

// ✅
const activeKey = getActiveKey(pathname);
setActiveKey(activeKey);
```
