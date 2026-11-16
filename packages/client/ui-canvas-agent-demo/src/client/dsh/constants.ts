/** Stable identifiers shared by the node and browser halves. */
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Key of the `main` panel owned by this demo. */
export const CANVAS_PANEL_ID = 'canvas-agent' as MainPanelId

/** Identifier of the overlay entry that hosts the floating conversation. */
export const FLOATING_OVERLAY_ID = 'canvas-agent-floating'

/**
 * Session-scoped slot declared by the overlay entry.
 *
 * Declaring a non-root child is what makes the renderer inject
 * `SessionProvider` into `FloatingChatWindow`; without it a root-scope entry
 * cannot bind a session.
 */
export const CONVERSATION_SLOT = 'canvas.agent.conversation'
