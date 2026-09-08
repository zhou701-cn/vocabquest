# Vue 工程师的 React 上手指南（VocabQuest 项目实战）

> 面向熟悉 Vue 2/3 的前端工程师，目标有二：
> 1. **对照本项目快速读懂代码、能独立改功能**（实用导向）
> 2. **补齐 React 体系知识**（体系导向）
>
> 文档配套项目：`vocabquest/`（React 18 + TypeScript + Vite + Supabase）。

---

## 一、项目结构梳理

```
vocabquest/
├── index.html                 # Vite 入口 HTML（类似 public/index.html）
├── vite.config.ts             # 构建配置（含 @/ 路径别名）
├── tailwind.config.js         # Tailwind 样式配置
├── package.json               # 依赖与脚本（pnpm dev / build / preview）
├── CLAUDE.md                  # 项目说明（AI 协作约定，人类也建议读）
│
├── code/                      # 与 React 无关的 Python 脚本（批量生成音频/词库数据）
├── public/                    # 静态资源（452 个单词发音 mp3、图片）
├── supabase/                  # Supabase 后端：Edge Functions + SQL 迁移
│
└── src/
    ├── main.tsx               # 应用入口：createRoot().render(<App/>)（Vue 的 createApp().mount 等价物）
    ├── App.tsx                # 顶层组件：路由表 + 全局 Provider 嵌套
    ├── App.css / index.css    # 全局样式（Tailwind 指令 + 少量自定义）
    │
    ├── components/            # 共享 UI 组件（项目很小，多用 Radix UI 现成组件）
    │   ├── ProtectedRoute.tsx       # 路由守卫（Vue Router 的 beforeEach 等价物）
    │   ├── ErrorBoundary.tsx        # 错误边界（Vue 没有原生等价，类组件实现）
    │   ├── LoadingSpinner.tsx       # 加载占位
    │   ├── SessionSummary.tsx       # 学习小结弹窗
    │   └── AchievementNotification.tsx
    │
    ├── contexts/
    │   └── AuthContext.tsx    # 登录态 / 用户信息（React Context，替代 Vue 的 provide/inject）
    │
    ├── hooks/
    │   └── use-mobile.tsx      # 自定义 Hook（组合式函数组合逻辑的 React 等价）
    │
    ├── lib/
    │   ├── supabase.ts        # Supabase 客户端单例
    │   ├── config.ts          # 环境变量/运行配置（含 Demo 登录开关）
    │   ├── utils.ts            # cn() 类名合并工具（clsx + tailwind-merge）
    │   ├── quizSession.ts      # 测验会话逻辑（纯 TS 类，无 UI）
    │   └── spellingSession.ts  # 拼写会话逻辑
    │
    ├── pages/                 # 路由级页面组件（一个文件 = 一个路由 = 约等于 Vue 的一个路由视图）
    │   ├── AuthPage.tsx             # 登录/注册页
    │   ├── AuthCallbackPage.tsx     # OAuth 回调（Supabase 登录后跳回处理）
    │   ├── DashboardPage.tsx        # 首页/学习模式入口
    │   ├── FlashcardsPage.tsx       # 闪卡模式
    │   ├── QuizPage.tsx             # 测验模式
    │   ├── SpellingPage.tsx         # 拼写模式
    │   ├── ReviewPage.tsx           # 智能复习模式（最复杂的页面之一）
    │   ├── ProfilePage.tsx          # 个人资料
    │   └── AdminPage.tsx            # 管理后台（词库 CRUD、AI 生成）
    │
    ├── stores/
    │   └── vocabularyStore.ts # Zustand 全局状态（对比 Vue 的 Pinia）
    │
    └── types/
        └── index.ts           # 全部 TypeScript 类型/接口定义（数据模型集中地）
```

### 关键数据流（读懂这条线，项目就通了）

```
用户点击 Dashboard 的「Quiz」
  → navigate('/quiz')  [react-router]
  → QuizPage 挂载
  → useVocabularyStore(): startLearningSession('quiz')  [Zustand]
  → 从 store.words 取词，组合成本次会话词集
  → 用户答题 → updateProgress() → 调用 Supabase 边缘函数 / 落库
  → 后台刷新 profile & gamification [AuthContext]
```

### 技术栈清单（对照 Vue 生态）

| 领域 | 本项目（React） | Vue 对应 |
|---|---|---|
| 框架 | React 18 | Vue 3 |
| 语言 | TypeScript | TypeScript |
| 构建 | Vite | Vite（一样） |
| 路由 | react-router-dom v6 | vue-router |
| 全局状态 | Zustand | Pinia |
| 跨组件注入 | React Context | provide / inject |
| 数据获取 | 直连 Supabase + Zustand（TanStack Query 已装但未大量用） | axios + Pinia 或 VueQuery |
| UI 组件库 | Radix UI + Tailwind | Element Plus / Naive UI + Tailwind |
| 样式 | TailwindCSS | TailwindCSS（一样） |
| 动画 | framer-motion | @vueuse/motion / GSAP |
| 图标 | lucide-react | @element-plus/icons / lucide-vue-next |
| 提示 | react-hot-toast | ElementPlus ElMessage / 自建 |
| 图表 | recharts（依赖已装） | ECharts / vue-echarts |
| 包管理 | pnpm | pnpm（一样） |

---

## 二、Vue → React 核心概念对照表

这是最重要的部分。React 没有「模板 + 选项式 API」，一切都是 **JavaScript 函数**。

### 1. 组件：SFC → 函数组件 + JSX

**Vue（SFC）**
```vue
<template>
  <button @click="handle" :class="{ active: on }">{{ label }}</button>
</template>
<script setup lang="ts">
const props = defineProps<{ label: string; on: boolean }>()
const emit = defineEmits<{ (e: 'click'): void }>()
const handle = () => emit('click')
</script>
```

**React（本项目风格）**
```tsx
interface Props { label: string; on: boolean; onClick: () => void }
export function MyButton({ label, on, onClick }: Props) {
  return (
    <button onClick={onClick} className={on ? 'active' : ''}>
      {label}
    </button>
  )
}
```
要点：
- 没有模板，HTML 写在 JS 里（JSX）。
- 没有 `emit`，子组件通过 **props 传进来的回调函数** 通知父组件（如 `onClick`）。
- 属性绑定：Vue `:class` → React `className`；Vue `:style` → `style={{...}}`；Vue `@click` → `onClick`。
- 条件渲染 `v-if` → `{cond && <X/>}` 或 `{cond ? <A/> : <B/>}`。
- 列表渲染 `v-for` → `{list.map(item => <X key={item.id} />)}`，**key 必须写**。

### 2. 响应式状态：data/ref/reactive → useState / useRef

| Vue | React |
|---|---|
| `ref(0)` | `const [count, setCount] = useState(0)` |
| `reactive({a:1})` | `useState({a:1})` 或 `useReducer` |
| `count.value++` | `setCount(c => c + 1)` |
| `ref<HTMLDiv>` 模板引用 | `const ref = useRef<HTMLDivElement>(null)` |

注意：React 的 `setState` 是**异步合并**的，要基于旧值更新必须用函数式写法 `setCount(c => c+1)`，这和 Vue 的 `ref` 直接改 `.value` 不一样。

### 3. 计算属性 / 侦听：computed / watch → useMemo / useEffect

| Vue | React |
|---|---|
| `computed(() => a + b)` | `const sum = useMemo(() => a + b, [a, b])` |
| `watch(x, fn)` | `useEffect(() => { fn() }, [x])` |
| `watchEffect` | `useEffect(() => {...}, [])` 内读取依赖 |

**最容易踩坑的一点：** `useEffect(fn, deps)` 的第二个参数 `deps` 是依赖数组，依赖变化才重新执行；空数组 `[]` = 仅挂载时执行一次（≈ Vue 的 `onMounted`）；**省略依赖数组 = 每次渲染都执行**（几乎不要这么写）。

### 4. 生命周期

| Vue | React |
|---|---|
| `onMounted` | `useEffect(() => {...}, [])` |
| `onUnmounted` | `useEffect(() => { return () => {...} }, [])` 里 return 清理函数 |
| `onUpdated` | 直接用 `useEffect(fn, [依赖])` |
| 无直接对应 | `useLayoutEffect`（DOM 变更后同步执行） |

### 5. 状态管理：Pinia → Zustand

本项目 `vocabularyStore.ts` 就是全局仓库：

```ts
// Pinia 风格
// const useX = defineStore('x', () => { const n = ref(0); return { n } })

// Zustand（本项目实际写法）
export const useVocabularyStore = create<VocabularyStore>((set, get) => ({
  words: [],
  fetchWordsForList: async (listId) => {
    set({ loading: true })
    const { data } = await supabase.from('vocabulary_words').select('*')
    set({ words: data || [], loading: false })
  },
}))
```
用法：`const { words, fetchWordsForList } = useVocabularyStore()`。
区别：Zustand **没有 mutation**，统一用 `set(...)`；不需要 `storeToRefs`，直接解构即可（响应式由 hook 保证）。

### 6. 跨层级注入：provide/inject → React Context

`AuthContext.tsx` 就是典型 Context：
```tsx
const AuthContext = createContext<AuthContextType | undefined>(undefined)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  return <AuthContext.Provider value={{ user, signIn /* ... */ }}>{children}</AuthContext.Provider>
}
export function useAuth() { return useContext(AuthContext)! }
```
对比 Vue：`app.provide()` + `inject()`。React 中 Provider 必须**显式包裹**在组件树外层（见 `App.tsx` 的 `<AuthProvider>`）。

### 7. 路由守卫：vue-router beforeEach → ProtectedRoute 组件

`ProtectedRoute.tsx` 把「未登录就跳登录页」封装成一个包裹组件：
```tsx
if (!user) return <Navigate to="/auth" replace />
if (requiredRole && profile?.role !== requiredRole) return <Navigate to="/dashboard" replace />
return <>{children}</>
```
路由在 `App.tsx` 里用 `<Route element={<ProtectedRoute><DashboardPage/></ProtectedRoute>} />` 声明，比 Vue 的 `beforeEach` 更声明式。

### 8. 样式方案（本项目）

项目用 **Tailwind 原子类**（和 Vue 项目里用 Tailwind 完全一样），个别全局样式写在 `index.css`/`App.css`。
- Vue 的 `<style scoped>` ≈ React 常用 **CSS Modules**（`xxx.module.css`）或继续用 Tailwind。
- 本项目几乎没有 CSS Modules，纯 Tailwind + 少量全局 CSS。
- 工具函数 `cn()`（`lib/utils.ts`）= `clsx + tailwind-merge`，用来条件拼接类名，可类比 Vue 里手写 class 字符串。

---

## 三、系统学习路径（React 体系）

按阶段推进，每个阶段都给「学什么 + 在本项目哪里练」。

### 阶段 0：先跑起来（10 分钟）
```bash
cd vocabquest
pnpm dev        # 默认起 Vite dev server（注意端口，浏览器访问新实例）
```
重点看 `main.tsx` 和 `App.tsx`，建立「入口 → 路由 → 页面」的整体印象。

### 阶段 1：JSX 与函数组件（1 天）
- 学：函数组件、`{}` 插值、`{}` 里写 JS 表达式、`props` 解构、`key`。
- 练：打开 `DashboardPage.tsx`，看它如何用 `useState` 控制 `showProfileMenu`，如何用 `.map()` 渲染学习模式卡片。
- 对照：把上面「概念对照表 §1」的 Vue/React 示例敲一遍。

### 阶段 2：Hooks 状态与副作用（2 天）
- 学：`useState`、`useRef`、`useMemo`、`useEffect`（**依赖数组是核心**）。
- 练：`QuizPage.tsx` 顶部一堆 `useState`（questions、currentQuestionIndex…）就是真实范例；`ReviewPage.tsx` 的 `useEffect(initializeReviewSession, [user, currentList])` 演示「依赖变化重新初始化」。
- 坑点：不要在 `useEffect` 里直接 setState 形成死循环；依赖要写全。

### 阶段 3：路由（半天）
- 学：`BrowserRouter`、`Routes/Route`、`useNavigate`（≈ `router.push`）、`useSearchParams`（≈ `route.query`）、`Navigate` 重定向。
- 练：`App.tsx` 路由表 + `ProtectedRoute.tsx` 守卫。

### 阶段 4：状态管理（1 天）
- 学：React Context（轻量共享）+ Zustand（全局仓库）。
- 练：先读 `AuthContext.tsx`（Context 范式），再读 `vocabularyStore.ts`（Zustand 范式）。
- 思考：为什么登录态用 Context、词汇/进度用 Zustand？（局部 vs 全局高频变更，可类比 Pinia 的 store 拆分。）

### 阶段 5：异步与数据获取（1 天）
- 学：`async/await` 在 React 里没有特殊封装，直接在事件函数或 `useEffect` 里用；加载态用 `useState` 管理。
- 练：`vocabularyStore.ts` 的 `fetchVocabularyLists / fetchWordsForList / fetchUserProgress` 全是「set loading → await → set data」范式。
- 扩展：了解 TanStack Query（`@tanstack/react-query`，本项目已装），它解决「服务端状态缓存」问题，是目前 React 数据获取的主流方案，和 Pinia 不在一个层次（它管的是服务器数据缓存，不是客户端状态）。

### 阶段 6：React 生态工具（按需）
- `framer-motion`：动画（本项目所有页面都在用 `motion.div`）。类比 Vue 的 `<Transition>` + `@vueuse/motion`。
- `lucide-react`：图标，用法 `import { BookOpen } from 'lucide-react'`，直接当组件 `<BookOpen/>`。
- `react-hot-toast`：`toast.success(...)`，对比 Element Plus 的 `ElMessage`。
- `recharts`：图表库（依赖已装，本项目暂未大量使用）。
- `Radix UI`：`components.json` + `shadcn` 风格的基础无障碍组件（本项目直接用其原语）。

### 阶段 7：TypeScript 深入（贯穿）
- 本项目类型集中在 `types/index.ts`，组件 props、store、函数返回都标注类型。
- 学：`interface`/`type`、泛型、联合类型、`as` 断言（本项目 AuthContext 里 `as unknown as SupabaseUser` 就是给本地伪造用户对象做类型断言，可重点看）。

---

## 四、项目上手路线（对照实战）

按这个顺序读代码，能最快具备「改功能」的能力：

1. **`main.tsx` → `App.tsx`**：理解入口、Provider 嵌套、路由表。
2. **`contexts/AuthContext.tsx`**：理解登录态如何被全局提供；重点看本次为「Demo 登录离线化」加的 `buildDemoSession / readDemoSession / writeDemoSession`（纯本地、不走接口、localStorage 持久化）。
3. **`components/ProtectedRoute.tsx`**：理解路由守卫怎么拦截未登录。
4. **`stores/vocabularyStore.ts`**：理解全局词汇/进度状态与数据获取范式。
5. **`pages/DashboardPage.tsx`**：入口页，串起 Auth + Store + 导航。
6. **`pages/ReviewPage.tsx` 或 `QuizPage.tsx`**：挑一个学习页，跟一遍「取词 → 答题 → 更新进度」数据流。
7. **尝试改一个小功能练手**：例如给 Dashboard 加一个学习模式入口、或调整 `config.ts` 里的 Demo 用户名 `LOCAL_LOGIN_FULL_NAME`。

### 关于本项目「接口离线化」的背景（便于你理解现有代码）
- 原版 `localSignIn` 会调用 Supabase 认证接口，接口不可用时报错 `Failed to fetch`。
- 现已改为**完全本地登录**：点击登录页 "Continue as Demo Student" 即构造本地会话（用户/资料/积分），写入 `localStorage`，刷新仍在线，全程不请求网络。
- 注意：除登录外的数据（单词列表、学习进度等）**仍依赖 Supabase 接口**；接口全不可用时这些页面会显示空数据，后续如需可再做本地化（这是另一个任务，不在本指南范围内）。

---

## 五、心智模型速记（Vue 老手的 5 条提醒）

1. **一切皆函数**：没有模板编译，JSX 就是 `return` 出来的 JS 值。
2. **没有双向绑定魔法**：状态变化靠显式 `setXxx`；UI 只是状态的纯函数投影。
3. **「props 向下、回调向上」**：子改父不用 `emit`，用父传下来的函数 prop。
4. **副作用都在 `useEffect`**：数据获取、订阅、计时器，记住写依赖数组 + 清理函数。
5. **状态管理分两层**：客户端状态用 Context/Zustand（≈ Pinia），服务端缓存用 TanStack Query（≈ Vue 里手写缓存层或 VueQuery）。

---

## 六、推荐练习（循序渐进）

| 难度 | 练习 | 对应知识点 |
|---|---|---|
| ★ | 修改 `config.ts` 的 Demo 用户名，刷新看效果 | props / 配置 / 重启 dev server |
| ★ | 在 Dashboard 增加一个新的学习模式按钮 | 组件、state、路由跳转 |
| ★★ | 给 `vocabularyStore` 加一个 `getLearnedCount()` 计算属性（用 `useMemo` 或纯函数） | Zustand / 派生状态 |
| ★★ | 用 `framer-motion` 给某个卡片加进入动画 | 动画生态 |
| ★★★ | 把某个页面的 `useState` 数据获取迁移到 TanStack Query | 服务端状态管理 |
| ★★★ | 自己新建一个 `pages/StatsPage.tsx` + 路由，用 `recharts` 画学习曲线 | 路由 / 图表生态 |
