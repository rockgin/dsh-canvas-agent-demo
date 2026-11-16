/** One canvas node: content plus the entry points into the agent session. */
import { useRef } from 'react'
import type { AgentNodeState, Anchor } from '../agent-port.ts'
import type { CanvasAgentService } from '../dsh/canvas-agent-service.ts'
import type { DemoNode } from './nodes.ts'
import { InlineAsk } from './InlineAsk.tsx'
import css from './canvas.module.css'

export interface NodeCardProps {
  readonly node: DemoNode
  readonly state: AgentNodeState | undefined
  readonly active: boolean
  readonly service: CanvasAgentService
}

const WINDOW_WIDTH = 460
const WINDOW_HEIGHT = 600

export function NodeCard({ node, state, active, service }: NodeCardProps) {
  const cardRef = useRef<HTMLElement>(null)

  const anchorOf = (): Anchor | undefined => {
    const element = cardRef.current
    if (element === null) return undefined
    const rect = element.getBoundingClientRect()
    return {
      top: Math.max(8, Math.min(window.innerHeight - WINDOW_HEIGHT, rect.top + 24)),
      left: Math.max(8, Math.min(window.innerWidth - WINDOW_WIDTH, rect.right + 16)),
    }
  }

  const open = () => service.openFloating(node.id, anchorOf())

  return (
    <article ref={cardRef} className={css.card} data-active={active}>
      <header className={css.cardHeader}>
        <h2 className={css.cardTitle}>{node.title}</h2>
        <span className={css.phase} data-phase={state?.phase ?? 'idle'}>
          {phaseLabel(state)}
        </span>
      </header>

      <p className={css.cardBody}>{node.body}</p>

      <InlineAsk nodeId={node.id} service={service} onOpen={open} />

      <footer className={css.cardFooter}>
        <button type="button" className={css.ghost} onClick={open}>
          {active ? '定位对话' : '展开对话'}
        </button>
        <button
          type="button"
          className={css.ghost}
          aria-pressed={state?.readOnly === true}
          onClick={() => service.setReadOnly(node.id, !(state?.readOnly === true))}
        >
          {state?.readOnly === true ? '已锁定只读' : '锁定只读'}
        </button>
        {state?.sessionId !== undefined ? (
          <button type="button" className={css.ghost} onClick={() => service.cancel(node.id)}>
            停止
          </button>
        ) : null}
      </footer>

      {state?.error !== undefined ? <p className={css.error}>{state.error}</p> : null}
    </article>
  )
}

function phaseLabel(state: AgentNodeState | undefined): string {
  switch (state?.phase ?? 'idle') {
    case 'creating':
      return '创建中'
    case 'ready':
      return '就绪'
    case 'error':
      return '出错'
    default:
      return '未开始'
  }
}
