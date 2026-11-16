#!/usr/bin/env node
/**
 * Copies the demo plugin into a DeepSeek Harness checkout.
 *
 * Usage:
 *   node scripts/install-into-dsh.mjs /path/to/deepseek-harness
 *   node scripts/install-into-dsh.mjs /path/to/deepseek-harness --force
 *
 * The target path is `packages/client/ui-canvas-agent-demo`, which keeps the
 * package inside the pnpm workspace and next to the shared client bundle
 * preset referenced by `tsdown.config.ts`.
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const source = join(repoRoot, 'packages/client/ui-canvas-agent-demo')

const args = process.argv.slice(2)
const force = args.includes('--force')
const targetRepoArg = args.find((arg) => !arg.startsWith('--'))

if (targetRepoArg === undefined) {
  console.error('Usage: node scripts/install-into-dsh.mjs /path/to/deepseek-harness [--force]')
  process.exit(1)
}

const targetRepo = resolve(targetRepoArg)
const marker = join(targetRepo, 'pnpm-workspace.yaml')
const clientDir = join(targetRepo, 'packages/client')

if (!existsSync(marker) || !existsSync(clientDir)) {
  console.error(`Not a DeepSeek Harness checkout: ${targetRepo}`)
  process.exit(1)
}

const destination = join(clientDir, 'ui-canvas-agent-demo')

if (existsSync(destination)) {
  if (!force) {
    console.error(`Already exists: ${destination}\nRe-run with --force to replace it.`)
    process.exit(1)
  }
  rmSync(destination, { recursive: true, force: true })
}

cpSync(source, destination, {
  recursive: true,
  filter: (path) => !path.includes(`${join(source, 'lib')}`) && !path.includes('node_modules'),
})

console.log(`Installed demo plugin into ${destination}`)
console.log('')
console.log('Next steps:')
console.log(`  cd ${targetRepo}`)
console.log('  pnpm install')
console.log('  pnpm dsh web')
console.log('')
console.log('The canvas registers itself as the `canvas-agent` main panel.')
