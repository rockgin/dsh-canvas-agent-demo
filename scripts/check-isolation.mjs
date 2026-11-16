#!/usr/bin/env node
/**
 * Architecture guard: the canvas layer must not import the Harness runtime.
 *
 * Only `src/client/dsh/**` and the plugin entry may depend on `@deepseek-ai/*`.
 * Everything else talks to `AgentPort`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../packages/client/ui-canvas-agent-demo/src/client')

const allowed = new Set(['dsh', 'index.ts', 'slots.ts'])
const files = []

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    const rel = relative(root, full)
    if (statSync(full).isDirectory()) {
      if (entry === 'dsh') continue
      walk(full)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (allowed.has(rel)) continue
    files.push(full)
  }
}

walk(root)

const offenders = []
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  // Match real module specifiers only; prose in comments is not a dependency.
  if (/(?:from\s*|import\s*\(\s*)['"]@deepseek-ai\//.test(content)) {
    offenders.push(relative(root, file))
  }
}

if (offenders.length > 0) {
  console.error('Isolation violated. These files must go through AgentPort instead of importing dsh:')
  for (const file of offenders) console.error(`  - ${file}`)
  process.exit(1)
}

console.log(`Isolation OK (${files.length} canvas/port files checked).`)
