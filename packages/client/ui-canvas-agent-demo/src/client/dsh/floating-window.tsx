/**
 * Floating conversation window.
 *
 * Registered on the root `shell.overlay` layer, so it floats above the canvas
 * regardless of which main panel is active. The entry declares a
 * session-scoped child slot; that declaration is what makes the renderer
 * inject `SessionProvider` and `renderSlot` here.
 */
import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentHook, AgentSnapshot } from '../agent-port.ts'
import type { CanvasAgentService } from './canvas-agent-service.ts'
import { CONVERSATION_SLOT, FLOATING_OVERLAY_ID } from './constants.ts'
import css from './floating.module.css'

export type FloatingChatWindowProps = PropsRuntime<'shell.overlay'> &
  PropsRenderSlots<typeof CONVERSATION_SLOT> & {
    service: CanvasAgentService
    useAgent: AgentHook<AgentSnapshot>
  }

export function FloatingChatWindow({
  service,
  useAgent,
  SessionProvider,
  renderSlot,
}: FloatingChatWindowProps) {
  const floating = useAgent((value) => value.floating)
  const nodeState = useAgent((value) =>
    value.floating.nodeId === null ? undefined : value.nodes[value.floating.nodeId],
  )
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    setPosition(null)
  }, [floating.nodeId])

  const reference = floating.nodeId === null ? undefined : service.referenceOf(floating.nodeId)
  if (!floating.open || floating.nodeId === null) return null

  const anchor = position ?? floating.anchor ?? { top: 96, left: 360 }

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const frame = event.currentTarget.parentElement
    if (frame === null) return
    const rect = frame.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top

    const move = (moveEvent: PointerEvent) => {
      setPosition({
        top: Math.max(8, Math.min(window.innerHeight - 160, moveEvent.clientY - offsetY)),
        left: Math.max(8, Math.min(window.innerWidth - 160, moveEvent.clientX - offsetX)),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <section
      className={css.window}
      style={{ top: anchor.top, left: anchor.left }}
      data-overlay={FLOATING_OVERLAY_ID}
      aria-label="Agent conversation"
    >
      <header className={css.header} onPointerDown={startDrag}>
        <span className={css.title}>
          <span className={css.dot} data-phase={nodeState?.phase ?? 'idle'} />
          {nodeState?.sessionId?.slice(0, 8) ?? '新会话'}
        </span>
        <span className={css.actions}>
          {nodeState?.readOnly === true ? <span className={css.badge}>只读</span> : null}
          <button type="button" className={css.iconButton} onClick={() => service.closeFloating()}>
            关闭
          </button>
        </span>
      </header>

      <div className={css.body}>
        {reference === undefined ? (
          <div className={css.placeholder}>
            {nodeState?.phase === 'error' ? nodeState.error : '正在准备会话…'}
          </div>
        ) : (
          <SessionProvider session={reference}>{renderSlot(CONVERSATION_SLOT, {})}</SessionProvider>
        )}
      </div>
    </section>
  )
}
