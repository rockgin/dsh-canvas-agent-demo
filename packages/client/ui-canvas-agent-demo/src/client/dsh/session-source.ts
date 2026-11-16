/**
 * Adds a reference source for sessions created by the canvas.
 *
 * `SessionReferenceSourceMap` is a declaration-merge extension point exported
 * by the session-controller client contract, so this is a supported way for a
 * feature package to name its own retention source.
 */
import type {} from '@deepseek-ai/dsh-api-session-controller/client'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    canvasAgent: unknown
  }
}
