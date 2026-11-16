/**
 * The session island: official Conversation content, rendered inside a host
 * that already provided a `SessionProvider`.
 *
 * Only `conversation.content` is used. It is the public factory intended for
 * reusable Conversation UI and it excludes the stock page header, so it can be
 * dropped into an arbitrary container.
 */
import type { PropsRuntime, PropsRenderFactories } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConversationViewsProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CONVERSATION_SLOT } from './constants.ts'
import css from './island.module.css'

export type ConversationIslandProps = PropsRuntime<typeof CONVERSATION_SLOT> & PropsRenderFactories

export function ConversationIsland({ useSession, renderFactorySlot }: ConversationIslandProps) {
  const session = useSession((value) => value)
  const active = session.running || !session.blank
  const phase = active ? 'active' : 'hero'

  return (
    <div className={css.island}>
      {renderFactorySlot(
        'conversation.content',
        { variant: 'embedded', phase, hero: phase === 'hero' },
        { slots: { views: ChatOnlyView } },
      )}
    </div>
  )
}

/**
 * Force the Chat view. The default view selector could otherwise land on a
 * business-provided view that assumes full-page chrome.
 */
function ChatOnlyView({ renderSlot }: ConversationViewsProps) {
  return <>{renderSlot('conversation.session', { view: 'chat' })}</>
}
