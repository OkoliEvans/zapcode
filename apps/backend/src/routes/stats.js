import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { merchants, transactions } from '../db/schema.js'

const router = Router()

// ── GET /api/stats/public ──────────────────────────────────────────────────
// Public stats for landing page — no auth required
router.get('/public', async (req, res) => {
  try {
    const [[merchantCount], [txCount], [uniqueSenders]] = await Promise.all([
      db.select({ count: sql`count(*)::int` })
        .from(merchants),
      db.select({ count: sql`count(*)::int` })
        .from(transactions)
        .where(eq(transactions.status, 'confirmed')),
      db.select({ count: sql`count(distinct ${transactions.fromAddress})::int` })
        .from(transactions),
    ])

    res.json({
      merchants:     merchantCount.count,
      payments:      txCount.count,
      uniqueSenders: uniqueSenders.count,
    })
  } catch (err) {
    console.error('[stats/public]', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router