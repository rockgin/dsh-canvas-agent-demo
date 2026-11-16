/**
 * Browser half of the canvas-agent demo.
 *
 * Everything the demo owns is registered here:
 *
 * - `main:'canvas-agent'`            → the canvas becomes the main view
 * - `sidebar.panellist:'canvas-agent'` → navigation entry back to it
 * - `shell.overlay:'canvas-agent-floating'` → root overlay hosting the window
 * - `canvas.agent.conversation`      → session-scoped island inside that window
 * - `conversation.composer`          → read-only takeover for locked sessions
 *
 * No Harness source is patched, and the canvas components are kept free of
 * `@deepseek-ai/*` imports (enforced by scripts/check-isolation.mjs).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

import { CanvasPanelIcon } from './canvas/CanvasPanelIcon.tsx'
import { CanvasRoot } from './canvas/CanvasRoot.tsx'
import { CANVAS_PANEL_ID, CONVERSATION_SLOT, FLOATING_OVERLAY_ID } from './dsh/constants.ts'
import { CanvasAgentService } from './dsh/canvas-agent-service.ts'
import { ConversationIsland } from './dsh/conversation-island.tsx'
import { FloatingChatWindow } from './dsh/floating-window.tsx'
import { ReadOnlyComposer, selectReadOnlyComposer } from './dsh/read-only-composer.tsx'
import './slots.ts'

export type * from './agent-port.ts'
export type { FloatingChatWindowProps } from './dsh/floating-window.tsx'
export type { ConversationIslandProps } from './dsh/conversation-island.tsx'
export type { ReadOnlyComposerProps, ReadOnlyComposerMatch } from './dsh/read-only-composer.tsx'

/** Services the demo composes with. Declaration order is not significant. */
export const inject = ['sessions', 'slots', 'layout', 'uiSession']

export function apply(ctx: ClientContext): void {
  const service = new CanvasAgentService(ctx)
  ctx.effect(() => () => service.dispose(), 'canvas-agent: release sessions')

  // The canvas is the only main occupant; the stock `conversation` panel stays
  // available through the sidebar and can be switched back to at any time.
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: CANVAS_PANEL_ID,
        inject: () => ({ service, hooks: { agent: service.source } }),
      },
      CanvasRoot,
    ),
  )

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: CANVAS_PANEL_ID,
        order: 5,
        label: () => '画布',
      },
      CanvasPanelIcon,
    ),
  )

  // `shell.overlay` is a root layer. Declaring a session-scoped child is what
  // makes the renderer hand `SessionProvider` and `renderSlot` to the window.
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: FLOATING_OVERLAY_ID,
        children: { 'canvas.agent.conversation': { kind: 'single', scope: 'session' } },
        inject: () => ({ service, hooks: { agent: service.source } }),
      },
      FloatingChatWindow,
    ),
  )

  ctx.slots.inject(CONVERSATION_SLOT, () =>
    ctx.slots.register({ name: CONVERSATION_SLOT }, ConversationIsland),
  )

  // Low priority so a business composer can still outrank this demo takeover.
  ctx.slots.inject('conversation.composer', () =>
    ctx.slots.register(
      {
        name: 'conversation.composer',
        priority: -10,
        select: (owner) => selectReadOnlyComposer(owner, service),
      },
      ReadOnlyComposer,
    ),
  )

  try {
    ctx.layout.selectPanel(CANVAS_PANEL_ID)
  } catch (error) {
    console.warn('[canvas-agent] canvas panel is not selectable yet', error)
  }
}
