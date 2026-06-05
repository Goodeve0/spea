---
name: vercel-react-best-practices
description: React 18 性能优化与组件设计指南。适用于 spea 项目的 web 前端（Vite + React 18 + TypeScript）。在编写或重构 web/src/ 下的 React 组件、状态管理、性能优化时使用。
license: MIT
compatibility: React 18, Vite
scope:
  paths:
    - "web/src/**"
  exclude:
    - "**/*.test.{ts,tsx}"
    - "**/*.spec.{ts,tsx}"
metadata:
  author: vercel
  version: "3.0-spea"
---

# React 18 Best Practices (spea 适配版)

> 精简自 Vercel React 最佳实践，针对 spea 项目（Vite + React 18 + TypeScript + Zustand）调整。
> 黄金原则：先测量，后优化；状态就近，组件精简。

---

## 一、性能优化

### useMemo / useCallback：不要默认套用

```tsx
// ❌ 简单计算别用 useMemo
const value = useMemo(() => a + b, [a, b])

// ✅ 仅用于昂贵计算
const sortedTurns = useMemo(() => {
  return turns.slice().sort((a, b) => a.timestamp - b.timestamp)
}, [turns])

// ❌ DOM 元素的回调用 useCallback 是浪费
<button onClick={useCallback(() => {}, [])}>

// ✅ 给优化过的子组件传回调时使用
const handleSubmit = useCallback(() => {
  startSession(scenarioId, difficulty)
}, [scenarioId, difficulty])

return <SessionStartButton onClick={handleSubmit} />
```

### React.memo

- **不要过早优化**：先用 React DevTools Profiler 确认有 re-render 问题
- **确保 props 稳定**：配合 useCallback 使用，否则 React.memo 失效
- **测量而非猜测**：性能优化前先确认瓶颈在 render 而不在网络/计算

---

## 二、状态管理

spea 使用 **Zustand**（见 `web/src/store/session.ts`）。

### 避免派生 State

```tsx
// ❌ 派生 state + useEffect 同步
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// ✅ 渲染时直接计算
const fullName = `${firstName} ${lastName}`
```

### 状态就近原则

- **状态放得离使用处越近越好**
- **跨组件共享 → Zustand store**；只在单组件用的状态留 useState
- **组合优于继承**：用 children/components 避免 prop drilling

### Zustand 用法约定

```tsx
// ❌ 整个 store 都拿
const store = useSessionStore()

// ✅ 只取需要的字段，避免无关字段变化触发 re-render
const greeting = useSessionStore(s => s.greeting)
const turns = useSessionStore(s => s.turns)
```

### Props 传递

- 避免通过多层组件传递大对象/数组
- 只传可序列化的数据
- 优先传 ID + 让子组件自己从 store 读

---

## 三、组件设计

### 保持组件精简

- 单个组件文件不超过 **200 行**
- 组件内超过 **50 行 hooks/事件处理** → 抽离到独立文件（自定义 Hook 或工具函数）
- WebSocket / 音频采集 / 语音合成等副作用 → 抽到 `web/src/audio/` 或 `web/src/ws-client/`，组件内只负责调用

### 组件拆分

```
web/src/
  components/
    ScenarioPicker/
      index.tsx
      index.module.scss
    DialogTimeline/
      index.tsx
      index.module.scss
    ReportRadar/
      index.tsx
      index.module.scss
```

按 **职责** 拆分（场景选择、对话时间轴、报告雷达图），不按 **页面** 堆叠。

---

## 四、代码分割

### 动态导入

```tsx
// 报告页用 Recharts，体积大，懒加载
const ReportRadar = React.lazy(() => import('./components/ReportRadar'))

<Suspense fallback={<div>加载中...</div>}>
  <ReportRadar data={radarScores} />
</Suspense>
```

### 拆分原则

- 路由级懒加载（react-router-dom 的 React.lazy + Suspense）
- 大型第三方库（recharts、@ricky0123/vad-web）按需加载
- 非首屏内容延迟加载

---

## 五、副作用与 useEffect 约束

每个 useEffect 只处理一种副作用。同一组件不超过 3 个，超出抽到自定义 Hook。

```tsx
// WebSocket 连接：必须返回清理函数
useEffect(() => {
  const client = createWsClient(url)
  client.connect()
  return () => client.disconnect()  // 必须清理
}, [url])

// 音频录制：必须释放资源
useEffect(() => {
  const recorder = startRecorder()
  return () => recorder.stop()
}, [])
```

---

## 六、检查清单

PR 自检：

- [ ] 没有过度使用 useMemo/useCallback（仅必要时）
- [ ] 没有派生 state + useEffect 同步模式
- [ ] Zustand 选择器只拿需要的字段
- [ ] 状态位置合理（就近原则）
- [ ] 组件内 hooks/事件超过 50 行已抽到独立文件
- [ ] WebSocket / 音频副作用都有清理函数
- [ ] 大型依赖（recharts 等）考虑了懒加载
- [ ] TypeScript 类型准确，没有 `any`
- [ ] 单文件不超过 200 行
