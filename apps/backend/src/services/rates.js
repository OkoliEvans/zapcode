// Rates service — 3 independent oracles averaged for reliability.
// Sources: Binance (largest CEX), CoinGecko (trusted aggregator), CryptoCompare (institutional)
// All free, no API keys required.

const CACHE_TTL_MS = 60_000
const cache = new Map() // "USDC:KES" → { rate, fetchedAt, sources }

// ── Oracle 1: Binance ──────────────────────────────────────────────────────
// Strategy: USDC/USDT price (≈1) × USDT/fiat from Binance ticker
// Binance public endpoint — no API key, no auth
async function fromBinance(to) {
  const upper = to.toUpperCase()

  // First get USDC/USDT rate (should be ~1.000)
  const usdcRes = await fetch(
    'https://data-api.binance.vision/api/v3/ticker/price?symbol=USDCUSDT',
    { signal: AbortSignal.timeout(5000) }
  )
  if (!usdcRes.ok) throw new Error(`Binance USDCUSDT ${usdcRes.status}`)
  const usdcData = await usdcRes.json()
  const usdcUsdRate = parseFloat(usdcData.price)

  // Then get USDT/fiat rate (e.g. USDTKES)
  const fiatRes = await fetch(
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=USDT${upper}`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!fiatRes.ok) throw new Error(`Binance USDT${upper} ${fiatRes.status} — pair may not exist`)
  const fiatData = await fiatRes.json()
  const usdtFiatRate = parseFloat(fiatData.price)

  return usdcUsdRate * usdtFiatRate
}

// ── Oracle 2: CoinGecko ────────────────────────────────────────────────────
async function fromCoinGecko(to) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${to.toLowerCase()}`
  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const data = await res.json()
  const rate = data['usd-coin']?.[to.toLowerCase()]
  if (!rate) throw new Error(`CoinGecko: no rate for ${to}`)
  return rate
}

// ── Oracle 3: ExchangeRate-API (open access, no key, 160+ currencies) ─────
async function fromExchangeRateAPI(to) {
  const url = `https://open.er-api.com/v6/latest/USD`
  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`ExchangeRateAPI ${res.status}`)
  const data = await res.json()
  const rate = data.rates?.[to.toUpperCase()]
  if (!rate) throw new Error(`ExchangeRateAPI: no rate for ${to}`)
  return rate
}

// ── Averaging ──────────────────────────────────────────────────────────────
async function fetchRateMultiOracle(to) {
  const results = await Promise.allSettled([
    fromBinance(to).then(r      => ({ source: 'Binance',       rate: r })),
    fromCoinGecko(to).then(r    => ({ source: 'CoinGecko',     rate: r })),
    fromExchangeRateAPI(to).then(r => ({ source: 'ExchangeRateAPI', rate: r })),
  ])

  const successful = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)

  const failed = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason?.message)

  if (successful.length === 0) {
    throw new Error(`All rate oracles failed for ${to}`)
  }

  const avg     = successful.reduce((sum, s) => sum + s.rate, 0) / successful.length
  const sources = successful.map(s => s.source)
  const rates   = successful.map(s => `${s.source}:${s.rate.toFixed(4)}`).join(', ')

  return { rate: avg, sources }
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchRate(from, to) {
  const key    = `${from}:${to}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached

  const { rate, sources } = await fetchRateMultiOracle(to)
  const entry = { rate, fetchedAt: Date.now(), sources }
  cache.set(key, entry)
  return entry
}

export async function convert(usdcAmount, toCurrency) {
  try {
    const { rate, fetchedAt, sources } = await fetchRate('USDC', toCurrency)
    return {
      amount:     parseFloat(usdcAmount) * rate,
      rate,
      currency:   toCurrency,
      fetchedAt,
      ageSeconds: Math.round((Date.now() - fetchedAt) / 1000),
      sources,
    }
  } catch {
    return null
  }
}