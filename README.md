# dsh-canvas-agent-demo

一个基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **公共客户端契约**的示例插件：

> 让**自己的 React 画布成为唯一主视图**，把 dsh 的完整会话能力以「锚定悬浮窗」的形式嵌进页面，并且业务代码不直接依赖 Harness 运行时。

不 fork、不 patch、不深引 `src/*`，可以直接放进 dsh monorepo 运行。

---

## 1. 演示了哪些场景

| 场景 | 实现位置 | 用到的公开契约 |
|---|---|---|
| 自己的组件占据 `main` | `src/client/canvas/CanvasRoot.tsx` | `main` keyed slot + `ctx.layout.selectPanel()` |
| 侧边栏导航回到画布 | `src/client/canvas/CanvasPanelIcon.tsx` | `sidebar.panellist` |
| 节点行内「问问 Agent」 | `src/client/canvas/InlineAsk.tsx` | 你自己的 UI + `AgentPort.ask()` |
| 锚定悬浮对话窗 | `src/client/dsh/floating-window.tsx` | `shell.overlay` + `SessionProvider` |
| 复用官方会话内容 | `src/client/dsh/conversation-island.tsx` | `conversation.content` factory |
| 固定为 Chat 视图 | `ChatOnlyView` | factory 本地 `views` slot + `conversation.session` |
| 会话创建 / 恢复 / 提问 / 停止 | `src/client/dsh/canvas-agent-service.ts` | `ctx.sessions.create/retain`、`SessionFace` |
| 只读输入区（单 Composer 约束） | `src/client/dsh/read-only-composer.tsx` | `conversation.composer` chain |
| 会话代际失效自动恢复 | `canvas-agent-service.ts` 的 `ask()` | 捕获 stale reference 后重新 retain |

---

## 2. 架构

```text
Electron Main
└── dsh Host（Agent / Tools / Persistence，完全不改）
        ▲  dsh 内部 RPC
Electron Renderer
└── dsh Client Composition (Cordis)
    ├── 官方插件：session-controller / ui-session / ui-conversation / ui-chat / ui-layout
    └── 本插件 @dsh-demo/dsh-client-ui-canvas-agent
        ├── main:'canvas-agent'                  → CanvasRoot（唯一主组件）
        ├── sidebar.panellist:'canvas-agent'     → 导航入口
        ├── shell.overlay:'canvas-agent-floating'→ FloatingChatWindow
        │     └── SessionProvider(session=ref)
        │           └── canvas.agent.conversation (session 作用域)
        │                 └── conversation.content (embedded)
        └── conversation.composer（只读接管）
```

调用链只有一条：

```text
Canvas 组件 → AgentPort → CanvasAgentService → ctx.sessions / SessionFace
                                    │
                                    └─ 暴露 SessionReference → SessionProvider → 官方 UI
```

### 为什么画布能成为主体

`main` 是 **keyed root slot**，同一时刻只渲染一个 key。官方占用 `conversation`，本示例注册 `canvas-agent` 并在启动后 `selectPanel('canvas-agent')`，因此中心区域只显示画布；官方会话面板仍可通过侧边栏切回。

### 为什么悬浮窗能拿到会话绑定

`shell.overlay` 是 root 作用域，**root 条目默认没有 `SessionProvider`**。本示例在注册浮层条目时声明了一个 session 作用域的子 slot：

```ts
children: { 'canvas.agent.conversation': { kind: 'single', scope: 'session' } }
```

渲染器据此把 `SessionProvider` 注入组件。随后用显式引用绑定会话，而不是继承当前页面绑定：

```tsx
<SessionProvider session={reference}>{renderSlot(CONVERSATION_SLOT, {})}</SessionProvider>
```

---

## 3. 目录结构

```text
packages/client/ui-canvas-agent-demo/
├── package.json              # dsh.client.inject 声明客户端依赖图
├── tsconfig.json             # 引用 dsh 各包的 client 工程
├── tsdown.config.ts          # 复用 dsh 的 client bundle 预设
└── src/
    ├── index.ts              # node half（空实现）
    └── client/
        ├── index.ts          # 插件入口：注册所有 slot / 服务
        ├── slots.ts          # SlotMap 声明合并
        ├── agent-port.ts     # 唯一业务接口（不含 dsh import）
        ├── canvas/           # 你的画布（禁止 import @deepseek-ai/*）
        │   ├── CanvasRoot.tsx
        │   ├── NodeCard.tsx
        │   ├── InlineAsk.tsx
        │   ├── CanvasPanelIcon.tsx
        │   ├── nodes.ts
        │   └── canvas.module.css
        └── dsh/              # 唯一允许依赖 dsh 的适配层
            ├── constants.ts
            ├── session-source.ts
            ├── canvas-agent-service.ts
            ├── conversation-island.tsx
            ├── floating-window.tsx
            ├── read-only-composer.tsx
            └── *.module.css
```

---

## 4. 运行

### 前置

- 一份 DeepSeek Harness 源码
- Node ≥ 20、pnpm

示例按 dsh `0.2.2-rc.3` 的公开契约编写。Developer Preview 阶段接口可能变动，升级时请先看 dsh 的 CHANGELOG。

### 安装进 dsh

```bash
node scripts/install-into-dsh.mjs /path/to/deepseek-harness
cd /path/to/deepseek-harness
pnpm install --no-frozen-lockfile
pnpm build
pnpm dsh web --patch ./canvas-agent.overlay.yml --no-open --port 3080
```

安装脚本做三件事：

1. 把 `packages/client/ui-canvas-agent-demo` 复制到目标仓库同一路径；
2. 把该包写进 `tsconfig.client.json` 的 references（dsh 的 typecheck/build 只认这份显式列表，不加就完全不覆盖你的包）；
3. 生成 `canvas-agent.overlay.yml`。

第 3 步容易被忽略：**dsh 的浏览器插件是从组合文件里读 roster，不是扫描目录**。`package.json` 的 `dsh.client` 只声明依赖关系，不会让插件自动出现在运行时页面里；必须通过 overlay 的 `insert` 行把插件加进 web 组合。

Desktop 走的是另一套 bundle/profile 组合，`pnpm dev:desktop` 不会读取这个 overlay。要在 Desktop 里验证，需把同一行写进对应 profile 的 `cordis.patch.yml`。

重复安装时加 `--force`：

```bash
node scripts/install-into-dsh.mjs /path/to/deepseek-harness --force
```

### CI 验证

`.github/workflows/verify.yml` 会在 GitHub Actions 上做完整验证：

1. 检出 dsh 到固定 commit（`DSH_REF`，与插件版本对应）；
2. 安装 demo 包并打上 `tsconfig.client.json` 与 overlay；
3. `pnpm install --no-frozen-lockfile`；
4. `pnpm typecheck`（整条 client face，包含本包）；
5. `pnpm build:artifacts`；
6. 断言 `lib/client.js` 产物存在且包含插件标识；
7. 真实启动 `dsh web`，用 HTTP 断言首页与 `/plugins/<包名>/client.js` 均可访问。

升级 dsh 时，同步修改 `DSH_REF` 与插件 `package.json` 里的 `@deepseek-ai/*` 版本即可。

### 预期效果

1. 启动后主区域是画布（三个示例节点）。
2. 在节点输入框里提问 → 右侧弹出悬浮会话窗，并立即发送该问题。
3. 悬浮窗内是官方完整会话 UI：流式消息、工具调用、审批、附件、模型选择等。
4. 点击「锁定只读」→ 该会话的 Composer 被替换为只读提示条。
5. 点击「停止」→ 调用 `SessionFace.cancel()`。

---

## 5. 关键实现

### 5.1 AgentPort：业务侧唯一依赖

`src/client/agent-port.ts` 不 import 任何 dsh 包：

```ts
export interface AgentPort {
  ensure(nodeId: string, input?: AgentWorkspaceInput): Promise<void>
  ask(nodeId: string, text: string): Promise<void>
  cancel(nodeId: string): Promise<void>
  release(nodeId: string): void
  setReadOnly(nodeId: string, readOnly: boolean): void
  openFloating(nodeId: string, anchor?: Anchor): void
  closeFloating(): void
}
```

`scripts/check-isolation.mjs` 会扫描 `canvas/` 与 `agent-port.ts`，出现 `@deepseek-ai/` 直接失败：

```bash
npm run check:isolation
```

### 5.2 会话生命周期

```ts
const sessionId = await ctx.sessions.create({ workspaceId, cwd, agentPreset })
const reference = ctx.sessions.retain(sessionId, { source: 'canvasAgent' })
await reference.ready
await reference.binding.session.prompt([{ type: 'text', text }], 'queue')
```

`source: 'canvasAgent'` 通过声明合并扩展，属于官方扩展点：

```ts
declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    canvasAgent: unknown
  }
}
```

### 5.3 代际失效恢复

Client 重连或重建 control stream 后，旧的 `SessionReference` 会失效。`ask()` 捕获这种情况并重试一次：

```ts
try {
  await this.prompt(reference, trimmed)
} catch (error) {
  if (!(error instanceof StaleSessionError)) throw error
  this.release(nodeId)
  reference = await this.currentReference(nodeId)
  await this.prompt(reference, trimmed)
}
```

### 5.4 只读 Composer

`conversation.composer` 是 selector 路由的 chain。示例以 `-10` 优先级注册，只接管自己标记为只读的 Session：

```ts
select: (owner) => selectReadOnlyComposer(owner, service)
```

这样同一个 Session 永远只有一个可写输入区。

---

## 6. 已知限制

- **`main` 同时只渲染一个 key。** 画布占据主区域时，官方主会话不会同时显示；需要侧边栏切回。
- **`conversation.content` 自带 Composer。** 因此本示例不在行内再挂一份会话内容；行内只做提问入口，完整会话在浮窗。
- **同一 Session 不应有两个可写 Composer。** 示例用只读接管保证这一点。
- **`shell.overlay` 默认点击穿透。** 浮窗根节点必须显式 `pointer-events: auto`。
- **root 作用域拿不到 `SessionProvider`。** 必须声明 session 作用域子 slot。
- **仍依赖 dsh Client Runtime。** 复用官方会话 UI 就无法脱离它的 Cordis 与 Slot 运行时；本示例隔离的是 *core 实现*，不是整个运行时。

---

## 7. 升级策略

- 所有 `@deepseek-ai/*` 依赖随 dsh 一起升级，不混版本。
- 只使用包根导出与声明的 Slot/Factory；升级前跑一次 `pnpm typecheck` 与人工冒烟。
- 若接口变动，优先改 `src/client/dsh/`；`canvas/` 与 `agent-port.ts` 通常不需要动。
- 契约测试建议固定这几条：`create → retain → ready`、`prompt` 后消息进入 `conversation.session`、浮层显式绑定生效、`conversation.content` 以 `embedded` 渲染、只读 Composer 命中。

---

## 8. 迁移到自己的应用

1. 把 `canvas/` 换成你的真实画布与文档模型。
2. 保留 `agent-port.ts`，按需增删能力；不要在画布里直接 import dsh。
3. 把 `CanvasAgentService` 中的 `nodeId` 映射改成你的文档节点 ID / 文件 ID。
4. 需要会话携带上下文时，在 `ask()` 组装 `PromptContentPart[]`（文本、图片、文件回执）。
5. 若要改成独立 Electron 壳，复用 dsh Desktop 的 Host 启动方式，Renderer 侧仍然挂这套 client 插件。

---

## License

MIT
