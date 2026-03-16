# Zapcode

> USDC payment QR system for merchants on Starknet. No dev or web3 knowledge required.

Merchants sign up with email, get a Starknet wallet, and immediately have a QR code
they can print and place anywhere. Buyers can pay directly on the Zapcode platform
with just an email login — no wallet app, no seed phrase, no gas. Zapcode watches
for incoming USDC and USDC.e transfers and notifies the merchant in real-time —
by email and in-app toast.

**Zapcode never holds funds.** All wallets are owned by their users via Privy.
Zapcode is purely monitoring, notification, and dashboard.

**Zero transaction fees.** All buyer payments are fully gas-sponsored by AVNU
paymaster. Merchants also pay zero fees on any transfers. Neither
party ever needs to hold STRK or ETH.

---

## Features

### For merchants
- **Email signup** — no MetaMask, no seed phrases. Sign up like any web2 app.
- **Instant wallet** — Starknet wallet created automatically on signup, prefunded
  with STRK for deployment.
- **QR code** — print-ready 800×800 PNG, downloadable in one tap. Works offline —
  the QR encodes the wallet address directly so it works even if Zapcode's servers
  are down.
- **Custom QR logo** — upload a business logo or paste a URL to embed it in the
  center of the QR code.
- **Live dashboard** — see every payment the moment it lands. Balance shown in
  both USDC and local currency equivalent.
- **Sound notification** — audio alert on new payment (M-Pesa-style ding).
- **Email notifications** — payment received email sent automatically on every
  confirmed transaction.
- **USDC + USDC.e** — accepts both native USDC and bridged USDC.e. Both shown
  separately and summed as total balance.
- **Multi-country** — balance displayed in merchant's local currency (KES, NGN,
  GHS, RWF, and 100+ others). Set at onboarding with full country selector.
- **Send tokens** — transfer USDC or USDC.e to any Starknet address directly from
  the dashboard settings page.
- **Offramp guide** — step-by-step how-to for cashing out USDC to local bank or
  mobile money. Country-specific platform recommendations (Binance P2P, Yellow
  Card, MoonPay, Transak, Resolva) shown based on merchant's country.
- **Zero fees** — all in-platform transfers are gas-sponsored. Merchants never
  need to hold STRK.

### For buyers
- **Pay on platform** — log in with email, get a wallet automatically, pay without
  leaving the page. No external wallet required.
- **Pay with existing wallet** — copy address and pay from Argent, Braavos, or any
  Starknet wallet. Both options shown on the same pay page.
- **USDC + USDC.e** — pay with either token. Balance shown for both, token
  selector appears when both have balance.
- **Local currency context** — live exchange rate shown on the pay page
  (e.g. "1 USDC ≈ 130 KES") so buyers can calculate amounts without leaving.
- **Zero fees** — all buyer transactions are fully gas-sponsored by AVNU. Buyers
  never need STRK or ETH.
- **Transaction receipt** — Voyager explorer link shown after payment completes.

---

## How It Works

### Merchant flow
1. Sign up with email → Starknet wallet created + 0.15 STRK prefunded automatically
2. Optionally upload logo → download branded QR code → print and place anywhere
3. Buyer scans QR → payment lands in wallet → dashboard + email notification fires
4. Go to Settings → Send tokens to exchange → cash out to bank or mobile money

### Buyer flow — on platform (no wallet needed)
1. Scan QR code → land on Zapcode pay page
2. Log in with email or Google (Privy)
3. Zapcode creates a Starknet wallet silently, prefunds with STRK, deploys account
4. Enter amount → pay → done. Gas fully sponsored — buyer pays nothing extra.

### Buyer flow — external wallet
1. Scan QR code → copy merchant address shown on the pay page
2. Send USDC or USDC.e from Argent, Braavos, or any Starknet wallet

Both options are always available on the same pay page.

### Cash out guide (merchants)
1. Go to **Settings → Send tokens** → transfer USDC to your exchange deposit address
2. On the exchange, sell USDC for local currency
3. Withdraw to bank account or mobile money (M-Pesa, MTN MoMo, Airtel Money, etc.)

Platform recommendations shown per country:
- **Kenya** → Binance P2P (KES/M-Pesa) + Yellow Card
- **Nigeria** → Binance P2P (NGN) + Resolva + Yellow Card
- **Ghana, Rwanda, Uganda, Tanzania** → Binance P2P + Yellow Card
- **South Africa, Egypt** → Binance P2P + MoonPay
- **India, Brazil, Philippines** → Binance P2P + Transak
- **All other countries** → MoonPay + Yellow Card + Transak

---

## Project Structure

```
zapcode/
│
├── apps/frontend/                     # Vite + React 19 + TypeScript
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── main.tsx                   # Entry — PrivyProvider, MerchantProvider, ToastProvider
│       ├── App.tsx                    # Routes with auth + onboarding guards
│       ├── index.css                  # Tailwind v4 + Google Fonts + grain overlay
│       │
│       ├── types/
│       │   └── index.ts               # Merchant, Transaction, Stats, PublicMerchant, FxRate
│       │
│       ├── services/
│       │   └── api.ts                 # Typed fetch wrapper — all API calls in one place
│       │
│       ├── context/
│       │   ├── MerchantContext.tsx    # Fetch + cache merchant profile + StarkZap wallet globally
│       │   └── ToastContext.tsx       # In-app toast notifications
│       │
│       ├── hooks/
│       │   ├── useTransactions.ts     # Fetch txs + stats, polls /latest every 5s for new payments
│       │   └── useBalance.ts          # Fetches USDC + USDC.e balances, sums total, refreshes 30s
│       │
│       ├── components/
│       │   ├── ui/
│       │   │   └── index.tsx          # Button, Spinner, Skeleton, StatusBadge, Label, CopyButton
│       │   ├── layout/
│       │   │   └── DashboardLayout.tsx # Sidebar nav + Outlet shell
│       │   └── dashboard/
│       │       ├── StatCard.tsx       # Metric card + OnboardingChecklist
│       │       ├── TransactionTable.tsx # Tx history with live highlight on new arrivals
│       │       └── QRCard.tsx         # QR preview, download, copy address/link
│       │
│       └── pages/
│           ├── LandingPage.tsx        # Marketing homepage with live public stats
│           ├── OnboardingPage.tsx     # 3-step merchant setup — name, country (auto-currency)
│           ├── OverviewPage.tsx       # Dashboard home — stats, balance, recent txs, QR card
│           ├── PaymentsPage.tsx       # Full transaction history
│           ├── QRPage.tsx             # Dedicated QR download + tips
│           ├── SettingsPage.tsx       # Edit profile, currency, send tokens, offramp guide
│           └── PayPage.tsx            # Buyer-facing scan + pay page (public)
│
└── apps/backend/                      # Node.js + Express (ESM)
    ├── drizzle.config.js
    ├── package.json
    ├── .env.example
    ├── drizzle/                       # Auto-generated migration files (git-tracked)
    └── src/
        ├── server.js                  # Express entry — mounts all routers
        ├── worker.js                  # Standalone watcher process (run separately)
        │
        ├── db/
        │   ├── schema.js              # Drizzle schema: merchants + transactions + buyers tables
        │   ├── index.js               # Drizzle client + pg Pool
        │   └── migrate.js             # Migration runner (node src/db/migrate.js)
        │
        ├── lib/
        │   ├── starknet.js            # Shared RPC provider, USDC + USDC.e addresses, Transfer selector
        │   └── privy.js               # Shared Privy clients — server-auth (verify) + node (wallet)
        │
        ├── services/
        │   ├── watcher.js             # pollOnce() — watches USDC + USDC.e Transfer events
        │   ├── rates.js               # CoinGecko USDC→fiat, 60s in-memory cache
        │   ├── email.js               # Nodemailer/Gmail — payment received + welcome templates
        │   └── qr.js                  # canvas + qrcode — 800×800 PNG, optional logo overlay
        │
        ├── middleware/
        │   └── auth.js                # requireAuth — Privy JWT verification
        │
        └── routes/
            ├── merchants.js           # Onboard, profile (me), public fetch, QR PNG download
            ├── transactions.js        # History, stats (all-time/today/week), latest poll
            ├── wallet.js              # Buyer wallet create + STRK prefund, sign relay, paymaster proxy
            ├── rates.js               # GET /api/rates?from=USDC&to=KES
            └── stats.js               # GET /api/stats/public — landing page counters
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/merchants/me`              | ✓ | Own merchant profile + live FX rate |
| POST | `/api/merchants/onboard`         | ✓ | First-time setup — creates Privy wallet + prefunds 0.15 STRK |
| PATCH| `/api/merchants/me`              | ✓ | Update businessName / currency / logoUrl |
| GET  | `/api/merchants/:id`             | — | Public merchant info (buyer pay page) |
| GET  | `/api/merchants/:id/qr.png`      | — | Print-ready 800×800 QR PNG — logo embedded if set |
| GET  | `/api/transactions`              | ✓ | Paginated tx history (`?limit=50`) |
| GET  | `/api/transactions/stats`        | ✓ | All-time, today, week aggregates |
| GET  | `/api/transactions/latest`       | ✓ | Latest tx id+timestamp (dashboard poll) |
| POST | `/api/wallet/starknet`           | ✓ | Create or fetch Starknet wallet — prefunds 0.2 STRK for new buyers |
| POST | `/api/wallet/sign`               | ✓ | Privy rawSign relay (Tier 2 chains) |
| POST | `/api/wallet/paymaster`          | — | AVNU paymaster proxy (keeps API key server-side) |
| GET  | `/api/rates?from=USDC&to=KES`    | — | FX rate with cache age |
| GET  | `/api/stats/public`              | — | Merchant count, payment count, unique senders |
| GET  | `/health`                        | — | Server health check |

---

## Frontend Routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing page with live network stats |
| `/onboard` | Merchant setup wizard (auth required, not yet onboarded) |
| `/dashboard` | Overview — stats, balance (USDC + USDC.e), recent txs, QR card |
| `/dashboard/payments` | Full transaction history |
| `/dashboard/qr` | QR code download + share |
| `/dashboard/settings` | Profile, currency, send tokens, offramp how-to guide |
| `/pay/:merchantId` | Buyer-facing payment page (public) |

---

## Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Postgres database (Neon, Supabase, Railway — any)
- Privy account → [privy.io](https://privy.io)
- Alchemy Starknet RPC URL (must use `v0_10` endpoint)
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords) enabled
- AVNU API key → [portal.avnu.fi](https://portal.avnu.fi)
- Treasury wallet: standard Argent X account on Starknet mainnet, **no guardian**

### 1. Backend

```bash
cd apps/backend
cp .env.example .env        # Fill in all values

pnpm install

pnpm db:generate
pnpm db:migrate

# Terminal 1 — API server
pnpm dev

# Terminal 2 — event watcher
pnpm worker
```

### 2. Frontend

```bash
cd apps/frontend
cp .env.example .env

pnpm install
pnpm dev
```

### 3. Run both at once

```bash
# From monorepo root
pnpm dev      # starts backend + frontend concurrently
pnpm worker   # separate terminal
```

---

## Environment Variables

### Backend `.env`

```bash
DATABASE_URL=postgresql://user:pass@host/zapcode
DATABASE_SSL=true                    # false for local postgres

PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_AUTHORIZATION_KEY=wallet-auth:...

# Must use v0_10 — older spec versions unsupported by starknet@9.x
STARKNET_RPC_URL=https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YOUR_KEY
STARKNET_NETWORK=mainnet

# Standard Argent X — NO guardian. Address must be lowercase hex.
TREASURY_ADDRESS=0x...
TREASURY_PRIVATE_KEY=0x...

AVNU_API_KEY=...

GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

IMGBB_API_KEY=...

PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`

```bash
VITE_API_URL=http://localhost:3001
VITE_PRIVY_APP_ID=your_privy_app_id
```

---

## Architecture Decisions

### Zero fees — fully sponsored transactions
Neither merchants nor buyers ever pay gas. AVNU paymaster sponsors all buyer
`execute()` calls (USDC transfers). Merchant in-platform transfers (send tokens
from Settings) are also sponsored. The only gas cost in the system is the
one-time account deployment per new wallet — covered by Zapcode's treasury STRK
prefund. After deployment, everything is free forever.

### Embedded buyer wallets — pay without leaving the page
Buyers do not need an external wallet. On the pay page they log in with email or
Google. Zapcode creates a Starknet wallet silently in the background, prefunds it
with STRK for deployment, and deploys the account on first use. The buyer enters
an amount and pays — no wallet app, no seed phrase, no gas. For buyers who already
have a Starknet wallet, the merchant address is also shown so they can pay from
Argent, Braavos, or any external wallet. Both paths are always available.

### Customizable QR codes
The QR PNG endpoint accepts an optional `logoUrl` from the merchant's profile.
If set, the logo is composited into the center of the QR using `canvas` server-side.
This produces a single branded PNG that works from any device — phones, tablets,
desktop — and is ready to print at 300dpi.

### Dual token event monitoring (USDC + USDC.e)
The watcher issues two `starknet_getEvents` calls per poll cycle — one for native
USDC (`0x033068f6...`) and one for bridged USDC.e (`0x053c9125...`). Both are
recorded with their `currency` label. RPC cost stays near **$0** up to thousands
of merchants.

### Treasury STRK prefunding
AVNU paymaster sponsors execution transactions but not `DEPLOY_ACCOUNT` transactions.
Zapcode's treasury wallet sends STRK to new wallets to cover the one-time deployment:
- New buyers: **0.2 STRK** — awaited before returning wallet to frontend
- New merchants: **0.15 STRK** — fire-and-forget after onboarding

Treasury requirements: standard Argent X, no guardian, lowercase hex address.

### Privy wallet clients — critical distinction
- `@privy-io/server-auth` — JWT verification, `getUser()`, `walletApi.getWallet()`
- `@privy-io/node` — wallet creation and `rawSign()` for all Starknet wallets

All wallets must be created via `@privy-io/node`. Starknet is a Tier 2 chain —
`server-auth` does not support `rawSign` for it. Mixing clients causes 401 errors.

### DB-backed currency + country config
`merchant.currency` and `merchant.country` are stored per merchant in Postgres.
One deployment serves merchants in 100+ countries simultaneously. Country is set
at onboarding via a searchable full-country selector — currency is auto-populated
from a country → currency map.

### Deterministic buyer wallets
Buyer wallet addresses are stored in the `buyers` table keyed by Privy user ID.
On every login, `/api/wallet/starknet` checks the DB first — same wallet returned
every time. No re-creation on reload.

### FX rates caching
All rate fetches go through `services/rates.js` — 60s in-memory cache. Nothing
calls CoinGecko directly from hot paths.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 · Cormorant (display) · DM Sans (body) |
| Auth | Privy (email / Google login) |
| Wallet (merchant) | `@privy-io/node` server-side Starknet wallet |
| Wallet (buyer) | `@privy-io/node` + StarkZap SDK (`starkzap@1.0.0`) |
| Blockchain | Starknet Mainnet |
| Token support | Native USDC + Bridged USDC.e |
| Starknet SDK | `starknet@9.4.2` (v0_10 RPC spec) |
| Paymaster | AVNU (all transactions sponsored) |
| Event monitoring | USDC + USDC.e Transfer event filter per poll cycle |
| Backend | Express 4 (ESM) + Node.js 20 |
| ORM | Drizzle ORM |
| Database | PostgreSQL — merchants, transactions, buyers tables |
| Email | Nodemailer + Gmail SMTP |
| FX Rates | CoinGecko API (60s cache) |
| QR Generation | `canvas` + `qrcode` — 800×800 PNG with optional logo overlay |
| Countries | `country-list` npm package |
| State | React Context + hooks |
| Routing | React Router v6 |
| Package manager | pnpm workspaces |