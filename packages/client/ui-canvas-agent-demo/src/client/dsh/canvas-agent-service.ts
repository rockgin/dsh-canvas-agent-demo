/**
 * dsh-backed implementation of {@link AgentPort}.
 *
 * This is the only module (together with `./session-source`) that talks to the
 * Harness session runtime. The canvas never imports it directly; the plugin
 * entry injects the instance as a service.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  AgentNodeState,
  AgentPort,
  AgentSnapshot,
  AgentWorkspaceInput,
  Anchor,
  FloatingState,
} from '../agent-port.ts'
import './session-source.ts'

interface NodeRecord {
  state: AgentNodeState
  reference?: SessionReference
  opening?: Promise<SessionReference | undefined> | undefined
}

/** Patch shape that tolerates explicit `undefined` (exactOptionalPropertyTypes). */
type AgentNodePatch = { readonly [K in keyof AgentNodeState]?: AgentNodeState[K] | undefined }

/** Thrown when a retained reference belongs to a replaced Client generation. */
class StaleSessionError extends Error {
  constructor() {
    super('session reference belongs to a stale client generation')
    this.name = 'StaleSessionError'
  }
}

export class CanvasAgentService implements AgentPort {
  private readonly records = new Map<string, NodeRecord>()
  private floating: FloatingState = {
    open: false,
    nodeId: null,
    sessionId: null,
    revision: 0,
    anchor: null,
  }
  private readonly listeners = new Set<() => void>()
  private snapshotCache: AgentSnapshot = { nodes: {}, floating: this.floating }
  private disposed = false

  constructor(private readonly ctx: Context) {}

  /** Observable source consumed by the injected `useAgent` hook. */
  readonly source = {
    getSnapshot: (): AgentSnapshot => this.snapshotCache,
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    },
  }

  snapshot(): AgentSnapshot {
    return this.snapshotCache
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Reference bound to a canvas node, for `SessionProvider session={...}`. */
  referenceOf(nodeId: string): SessionReference | undefined {
    return this.records.get(nodeId)?.reference
  }

  /** Used by the read-only composer selector. */
  isReadOnlySession(sessionId: string): boolean {
    for (const record of this.records.values()) {
      if (record.state.sessionId === sessionId) return record.state.readOnly
    }
    return false
  }

  async ensure(nodeId: string, input: AgentWorkspaceInput = {}): Promise<void> {
    const record = this.records.get(nodeId)
    if (record?.reference !== undefined) return
    if (record?.opening !== undefined) {
      await record.opening
      return
    }

    this.patch(nodeId, { phase: 'creating', error: undefined })
    const opening = this.open(nodeId, input)
    const current = this.records.get(nodeId)
    if (current !== undefined) this.records.set(nodeId, { ...current, opening })
    await opening
  }

  async ask(nodeId: string, text: string): Promise<void> {
    const trimmed = text.trim()
    if (trimmed === '') return

    let reference = await this.currentReference(nodeId)
    if (reference === undefined) return

    try {
      await this.prompt(reference, trimmed)
    } catch (error) {
      if (!(error instanceof StaleSessionError)) throw error
      // The Client rebuilt its control stream (reconnect / generation change).
      // Drop the dead reference and retry once against a fresh one.
      this.release(nodeId)
      reference = await this.currentReference(nodeId)
      if (reference === undefined) return
      await this.prompt(reference, trimmed)
    }
  }

  async cancel(nodeId: string): Promise<void> {
    const reference = this.records.get(nodeId)?.reference
    if (reference === undefined) return
    try {
      const result = await sessionFaceOf(reference).cancel()
      if (!result.ok) this.patch(nodeId, { error: messageOf(result.error) })
    } catch (error) {
      this.patch(nodeId, { error: messageOf(error) })
    }
  }

  release(nodeId: string): void {
    const record = this.records.get(nodeId)
    if (record?.reference !== undefined) {
      try {
        record.reference.release()
      } catch {
        // Already released by the runtime; nothing to do.
      }
    }
    this.records.delete(nodeId)
    if (this.floating.nodeId === nodeId) {
      this.floating = { ...this.floating, open: false, nodeId: null, sessionId: null, revision: this.floating.revision + 1 }
    }
    this.emit()
  }

  setReadOnly(nodeId: string, readOnly: boolean): void {
    this.patch(nodeId, { readOnly })
    if (this.floating.nodeId === nodeId) {
      this.floating = { ...this.floating, revision: this.floating.revision + 1 }
      this.emit()
    }
  }

  openFloating(nodeId: string, anchor?: Anchor): void {
    this.floating = {
      open: true,
      nodeId,
      sessionId: this.records.get(nodeId)?.state.sessionId ?? null,
      revision: this.floating.revision + 1,
      anchor: anchor ?? this.floating.anchor,
    }
    this.emit()
    void this.ensure(nodeId).then(() => {
      if (this.floating.nodeId !== nodeId) return
      this.floating = {
        ...this.floating,
        sessionId: this.records.get(nodeId)?.state.sessionId ?? null,
        revision: this.floating.revision + 1,
      }
      this.emit()
    })
  }

  closeFloating(): void {
    this.floating = { ...this.floating, open: false, revision: this.floating.revision + 1 }
    this.emit()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const nodeId of [...this.records.keys()]) this.release(nodeId)
    this.listeners.clear()
  }

  private async currentReference(nodeId: string): Promise<SessionReference | undefined> {
    await this.ensure(nodeId)
    return this.records.get(nodeId)?.reference
  }

  private async open(nodeId: string, input: AgentWorkspaceInput): Promise<SessionReference | undefined> {
    try {
      const options: { workspaceId: never; cwd?: string; agentPreset?: string } = {
        // Branded ids are opaque to the demo; the caller supplies a real one.
        workspaceId: input.workspaceId as never,
      }
      if (input.cwd !== undefined) options.cwd = input.cwd
      if (input.agentPreset !== undefined) options.agentPreset = input.agentPreset

      const sessionId = await this.ctx.sessions.create(options)
      const reference = this.ctx.sessions.retain(sessionId, { source: 'canvasAgent' })
      await reference.ready
      this.records.set(nodeId, {
        state: {
          nodeId,
          sessionId,
          phase: 'ready',
          readOnly: this.records.get(nodeId)?.state.readOnly ?? false,
        },
        reference,
      })
      this.emit()
      return reference
    } catch (error) {
      this.patch(nodeId, { phase: 'error', error: messageOf(error) })
      return undefined
    } finally {
      const record = this.records.get(nodeId)
      if (record !== undefined) this.records.set(nodeId, { ...record, opening: undefined })
    }
  }

  private async prompt(reference: SessionReference, text: string): Promise<void> {
    const session = sessionFaceOf(reference)
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) {
      const message = messageOf(result.error)
      this.patchBySession(reference, message)
      throw new Error(message)
    }
  }

  private patchBySession(reference: SessionReference, error: string): void {
    for (const [nodeId, record] of this.records) {
      if (record.reference === reference) {
        this.patch(nodeId, { error })
        return
      }
    }
  }

  private patch(nodeId: string, patch: AgentNodePatch): void {
    const existing = this.records.get(nodeId)
    const base: AgentNodeState = existing?.state ?? {
      nodeId,
      phase: 'idle',
      readOnly: false,
    }
    const next: AgentNodeState = {
      nodeId,
      phase: patch.phase ?? base.phase,
      readOnly: patch.readOnly ?? base.readOnly,
      // Preserve the session when the patch does not mention it, and drop the
      // message when a patch explicitly clears it.
      ...(patch.sessionId !== undefined
        ? { sessionId: patch.sessionId }
        : base.sessionId !== undefined
          ? { sessionId: base.sessionId }
          : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    }
    this.records.set(nodeId, { ...existing, state: next })
    this.emit()
  }

  private emit(): void {
    const nodes: Record<string, AgentNodeState> = {}
    for (const [nodeId, record] of this.records) nodes[nodeId] = record.state
    this.snapshotCache = { nodes, floating: this.floating }
    for (const listener of [...this.listeners]) listener()
  }
}

function sessionFaceOf(reference: SessionReference) {
  try {
    return reference.binding.session
  } catch {
    throw new StaleSessionError()
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const value = error as { message?: unknown; code?: unknown }
    if (typeof value.message === 'string') return value.message
    if (typeof value.code === 'string') return value.code
  }
  return String(error)
}
