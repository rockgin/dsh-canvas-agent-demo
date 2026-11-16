/**
 * Lightweight inline entry.
 *
 * Deliberately does NOT embed Conversation UI: an inline row gets a prompt box
 * and a status line, and the real transcript lives in the anchored floating
 * window. This keeps the "one writable composer per Session" rule intact and
 * avoids re-implementing the message list.
 */
import { useState } from 'react'
import type { CanvasAgentService } from '../dsh/canvas-agent-service.ts'
import css from './canvas.module.css'

export interface InlineAskProps {
  readonly nodeId: string
  readonly service: CanvasAgentService
  readonly onOpen: () => void
}

export function InlineAsk({ nodeId, service, onOpen }: InlineAskProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    const text = draft.trim()
    if (text === '' || sending) return
    setSending(true)
    setDraft('')
    onOpen()
    try {
      await service.ask(nodeId, text)
    } catch {
      // The service already mirrors the failure into the node snapshot; the
      // card renders it next to the input.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={css.ask}>
      <input
        className={css.input}
        value={draft}
        placeholder="问问这个节点…"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void send()
          }
        }}
      />
      <button type="button" className={css.send} disabled={sending || draft.trim() === ''} onClick={() => void send()}>
        {sending ? '…' : '提问'}
      </button>
    </div>
  )
}
