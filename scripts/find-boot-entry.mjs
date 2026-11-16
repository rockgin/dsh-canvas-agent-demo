#!/usr/bin/env node
/**
 * Print the boot URL of one client plugin from a served index.html.
 *
 * The web Host inlines the composed client graph as `window.__DSH_BOOT__`.
 * Browser entries are combo URLs carrying a revision query, so the asset
 * cannot be addressed by package name alone; read it from the graph instead.
 *
 * Usage: find-boot-entry.mjs <index.html> <plugin-id>
 * Exit codes: 0 found, 2 no inline graph, 3 plugin not in graph.
 */
import { readFileSync } from 'node:fs'

const [htmlPath, pluginId] = process.argv.slice(2)
if (!htmlPath || !pluginId) {
  console.error('usage: find-boot-entry.mjs <index.html> <plugin-id>')
  process.exit(64)
}

const html = readFileSync(htmlPath, 'utf8')
const marker = html.indexOf('__DSH_BOOT__')
if (marker < 0) {
  console.error('index.html does not inline __DSH_BOOT__')
  process.exit(2)
}

const start = html.indexOf('{', html.indexOf('=', marker))
if (start < 0) {
  console.error('could not locate the boot graph object literal')
  process.exit(2)
}

let depth = 0
let end = -1
let inString = false
let escaped = false
for (let i = start; i < html.length; i += 1) {
  const char = html[i]
  if (inString) {
    if (escaped) escaped = false
    else if (char === '\\') escaped = true
    else if (char === '"') inString = false
    continue
  }
  if (char === '"') inString = true
  else if (char === '{') depth += 1
  else if (char === '}') {
    depth -= 1
    if (depth === 0) {
      end = i + 1
      break
    }
  }
}

if (end < 0) {
  console.error('unterminated boot graph object literal')
  process.exit(2)
}

const graph = JSON.parse(html.slice(start, end))
const entries = (graph.batches ?? []).flatMap(batch => batch.entries ?? [])
const hit = entries.find(entry => entry.id === pluginId)
if (hit === undefined) {
  console.error(`plugin ${pluginId} is not in the boot graph; saw:`)
  for (const entry of entries) console.error(`  ${entry.id}`)
  process.exit(3)
}

process.stdout.write(String(hit.url))
