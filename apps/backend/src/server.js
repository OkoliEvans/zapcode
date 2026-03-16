import 'dotenv/config'
import express  from 'express'
import cors     from 'cors'
import process  from 'node:process'

import merchantsRouter    from './routes/merchants.js'
import transactionsRouter from './routes/transactions.js'
import walletRouter       from './routes/wallet.js'
import ratesRouter        from './routes/rates.js'
import statsRouter        from './routes/stats.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin:      process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/merchants',    merchantsRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/wallet',       walletRouter)
app.use('/api/rates',        ratesRouter)
app.use('/api/stats',        statsRouter)

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message ?? 'Internal server error' })
})

app.listen(PORT, () => console.log(`[zapcode] server → http://localhost:${PORT}`))