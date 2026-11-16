/**
 * Optional: claim the resident composer for sessions marked read-only.
 *
 * `conversation.composer` is a selector-routed chain. Registering a negative
 * priority entry lets the demo replace the composer for exactly those
 * sessions it owns, without touching the Conversation implementation.
 *
 * This is also the mechanism that keeps "one writable composer per session"
 * true: when a canvas node is locked, its floating window shows the read-only
 * bar instead of a second input.
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CanvasAgentService } from './canvas-agent-service.ts'
import css from './island.module.css'

export interface ReadOnlyComposerMatch {
  readonly reason: 'locked'
}

export type ReadOnlyComposerProps = PropsRuntime<'conversation.composer'> & {
  readonly matched: ReadOnlyComposerMatch
}

export function selectReadOnlyComposer(
  owner: { readonly sessionId?: string | undefined },
  service: CanvasAgentService,
): ReadOnlyComposerMatch | null {
  if (owner.sessionId === undefined) return null
  return service.isReadOnlySession(owner.sessionId) ? { reason: 'locked' } : null
}

export function ReadOnlyComposer({ matched }: ReadOnlyComposerProps) {
  return (
    <div className={css.readOnly}>
      <span>{matched.reason === 'locked' ? '该节点已锁定为只读。' : '只读会话。'}</span>
      <span className={css.readOnlyHint}>在画布节点上解锁后可继续输入。</span>
    </div>
  )
}
