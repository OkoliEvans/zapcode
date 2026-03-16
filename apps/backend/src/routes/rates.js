import { Router } from 'express'
import { fetchRate } from '../services/rates.js'

const router = Router()

// GET /api/rates?from=USDC&to=KES
router.get('/', async (req, res) => {
  const { from = 'USDC', to = 'USD' } = req.query
  try {
    const { rate, fetchedAt } = await fetchRate(from, to)
    res.json({
      from,
      to,
      rate,
      fetchedAt,
      ageSeconds: Math.round((Date.now() - fetchedAt) / 1000),
    })
  } catch (err) {
    res.status(502).json({ error: `Rate fetch failed: ${err.message}` })
  }
})

export default router