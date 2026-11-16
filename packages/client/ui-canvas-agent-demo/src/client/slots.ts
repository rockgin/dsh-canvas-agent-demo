/**
 * Slot bookkeeping for the demo.
 *
 * `SlotMap` is the official declaration-merge point: registering a slot name
 * that is not declared here is a type error. Augmenting it is how a third
 * party package adds its own embedding point without touching dsh sources.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * A single Conversation rendered inside the floating window.
     *
     * Scope is `session`, so the owning entry receives `SessionProvider` and
     * `useSession`, and can bind an explicit `SessionReference`.
     */
    'canvas.agent.conversation': {
      kind: 'single'
      scope: 'session'
    }
  }
}

export {}
