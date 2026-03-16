/**
 * Zapcode — USDC Transfer Watcher
 *
 * Run as a separate process: `node src/worker.js`
 * Both this and server.js share the same Postgres DB.
 *
 * POLL_INTERVAL_MS defaults to 3000 (3s).
 * Raise to 15000+ on Alchemy free tier if you approach rate limits.
 */

import 'dotenv/config'
import process from 'node:process'
import { pollOnce } from './services/watcher.js'

const INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10)

console.log(`[worker] USDC watcher starting — interval ${INTERVAL}ms`)
console.log(`[worker] network: ${process.env.STARKNET_NETWORK ?? 'sepolia'}`)

let running = false

async function tick() {
  if (running) return   // skip if previous poll hasn't finished
  running = true
  try {
    await pollOnce()
  } catch (err) {
    // Log but don't crash — transient RPC errors are expected
    console.error('[worker] poll error:', err.message)
  } finally {
    running = false
  }
}

// Initial tick immediately, then on interval
tick()
setInterval(tick, INTERVAL)

// Graceful shutdown
process.on('SIGINT',  () => { console.log('[worker] shutting down'); process.exit(0) })
process.on('SIGTERM', () => { console.log('[worker] shutting down'); process.exit(0) })