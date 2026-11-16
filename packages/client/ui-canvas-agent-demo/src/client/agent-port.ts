/**
 * The only interface the canvas layer is allowed to depend on.
 *
 * This file must stay free of `@deepseek-ai/*` imports. If the canvas ever
 * needs a new capability, add it here first and implement it inside
 * `./dsh/` — never import the Harness runtime from the canvas components.
 */

export type AgentPhase = 'idle' | 'creating' | 'ready' | 'error'

export interface AgentNodeState {
  readonly nodeId: string
  readonly sessionId?: string
  readonly phase: AgentPhase
  readonly readOnly: boolean
  readonly error?: string
}

export interface FloatingState {
  readonly open: boolean
  readonly nodeId: string | null
  readonly sessionId: string | null
  /** Bumped whenever the bound reference is replaced or a flag flips. */
  readonly revision: number
  readonly anchor: { readonly top: number; readonly left: number } | null
}

export interface AgentSnapshot {
  readonly nodes: Readonly<Record<string, AgentNodeState>>
  readonly floating: FloatingState
}

export interface AgentWorkspaceInput {
  readonly workspaceId?: string
  readonly cwd?: string
  readonly agentPreset?: string
}

export interface Anchor {
  readonly top: number
  readonly left: number
}

export interface AgentPort {
  ensure(nodeId: string, input?: AgentWorkspaceInput): Promise<void>
  ask(nodeId: string, text: string): Promise<void>
  cancel(nodeId: string): Promise<void>
  release(nodeId: string): void
  setReadOnly(nodeId: string, readOnly: boolean): void
  openFloating(nodeId: string, anchor?: Anchor): void
  closeFloating(): void
  snapshot(): AgentSnapshot
  subscribe(listener: () => void): () => void
}

/** Minimal selector-hook shape produced by the slot runtime. */
export type AgentHook<T> = <S>(selector: (value: T) => S) => S
