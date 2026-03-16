import { Router } from 'express'
import { eq, desc, and, gte, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { transactions, merchants } from '../db/schema.js'

const router = Router()

// ── GET /api/transactions — merchant's own transaction history ─────────────
router.get('/', requireAuth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  ?? '50',  10), 200)
  const offset = parseInt(req.query.offset ?? '0', 10)

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantId, req.userId))
    .orderBy(desc(transactions.detectedAt))
    .limit(limit)
    .offset(offset)

  res.json(rows)
})

// ── GET /api/transactions/stats — aggregated stats for dashboard ───────────
router.get('/stats', requireAuth, async (req, res) => {
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.id, req.userId))
    .limit(1)
  if (!merchant) return res.status(404).json({ error: 'Not onboarded' })

  const now       = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7)

  const [allTime] = await db
    .select({
      totalRevenue: sql`coalesce(sum(amount::numeric), 0)`,
      orderCount:   sql`count(*)::int`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.merchantId, req.userId),
      eq(transactions.status, 'confirmed'),
    ))

  const [today] = await db
    .select({
      todayRevenue: sql`coalesce(sum(amount::numeric), 0)`,
      todayOrders:  sql`count(*)::int`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.merchantId, req.userId),
      eq(transactions.status, 'confirmed'),
      gte(transactions.detectedAt, todayStart),
    ))

  const [week] = await db
    .select({
      weekRevenue: sql`coalesce(sum(amount::numeric), 0)`,
      weekOrders:  sql`count(*)::int`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.merchantId, req.userId),
      eq(transactions.status, 'confirmed'),
      gte(transactions.detectedAt, weekStart),
    ))

  const totalRevenue = parseFloat(allTime.totalRevenue)
  const orderCount   = allTime.orderCount

  res.json({
    totalRevenue,
    orderCount,
    avgOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
    todayRevenue:  parseFloat(today.todayRevenue),
    todayOrders:   today.todayOrders,
    weekRevenue:   parseFloat(week.weekRevenue),
    weekOrders:    week.weekOrders,
  })
})

// ── GET /api/transactions/latest — most recent tx timestamp (for polling) ──
router.get('/latest', requireAuth, async (req, res) => {
  const [row] = await db
    .select({ detectedAt: transactions.detectedAt, id: transactions.id })
    .from(transactions)
    .where(eq(transactions.merchantId, req.userId))
    .orderBy(desc(transactions.detectedAt))
    .limit(1)

  res.json({ latestId: row?.id ?? null, latestAt: row?.detectedAt ?? null })
})

export default router