/**
 * The canvas itself is the sole `main` occupant.
 *
 * It receives only its own `service` and the injected `useAgent` hook, so it
 * has no compile-time dependency on the Harness packages.
 */
import type { AgentHook, AgentSnapshot } from '../agent-port.ts'
import type { CanvasAgentService } from '../dsh/canvas-agent-service.ts'
import { NodeCard } from './NodeCard.tsx'
import { DEMO_NODES } from './nodes.ts'
import css from './canvas.module.css'

export interface CanvasRootProps {
  readonly service: CanvasAgentService
  readonly useAgent: AgentHook<AgentSnapshot>
}

export function CanvasRoot({ service, useAgent }: CanvasRootProps) {
  const nodes = useAgent((snapshot) => snapshot.nodes)
  const floating = useAgent((snapshot) => snapshot.floating)

  return (
    <div className={css.canvas}>
      <header className={css.header}>
        <div>
          <h1 className={css.heading}>Canvas</h1>
          <p className={css.subheading}>
            画布是唯一主视图；每个节点的对话以锚定浮层承载，复用 dsh 的会话内容。
          </p>
        </div>
        <span className={css.hint}>行内只做提问入口，完整会话在浮层中</span>
      </header>

      <div className={css.grid}>
        {DEMO_NODES.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            state={nodes[node.id]}
            active={floating.open && floating.nodeId === node.id}
            service={service}
          />
        ))}
      </div>
    </div>
  )
}
