import {
  pgTable, text, numeric, timestamp, boolean, pgEnum, varchar, index,
} from 'drizzle-orm/pg-core'

export const txStatusEnum = pgEnum('tx_status', ['pending', 'confirmed', 'failed'])

// ── Merchants ──────────────────────────────────────────────────────────────
export const merchants = pgTable('merchants', {
  id:             text('id').primaryKey(),              // Privy userId
  email:          text('email').notNull().unique(),
  businessName:   text('business_name').notNull(),
  walletId:       text('wallet_id').notNull(),          // Privy wallet id
  walletAddress:  text('wallet_address').notNull().unique(),
  publicKey:      text('public_key').notNull(),
  currency:       varchar('currency', { length: 3 }).notNull().default('USD'),
  country:        varchar('country',  { length: 2  }).notNull().default('KE'),
  network:        text('network').notNull().default('sepolia'),
  logoUrl:        text('logo_url'),
  isActive:       boolean('is_active').notNull().default(true),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  walletAddressIdx: index('merchant_wallet_address_idx').on(t.walletAddress),
}))

// ── Transactions ───────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:             text('id').primaryKey(),              // uuid
  merchantId:     text('merchant_id').notNull().references(() => merchants.id),
  txHash:         text('tx_hash').notNull().unique(),
  fromAddress:    text('from_address').notNull(),
  toAddress:      text('to_address').notNull(),
  amount:         numeric('amount', { precision: 28, scale: 6 }).notNull(),
  currency:       varchar('currency', { length: 10 }).notNull().default('USDC'),
  status:         txStatusEnum('status').notNull().default('pending'),
  blockNumber:    text('block_number'),
  note:           text('note'),                         // optional buyer note (future)
  emailSent:      boolean('email_sent').notNull().default(false),
  detectedAt:     timestamp('detected_at').notNull().defaultNow(),
  confirmedAt:    timestamp('confirmed_at'),
}, (t) => ({
  merchantIdIdx:  index('tx_merchant_id_idx').on(t.merchantId),
  txHashIdx:      index('tx_hash_idx').on(t.txHash),
  detectedAtIdx:  index('tx_detected_at_idx').on(t.detectedAt),
}))

// ── Buyers ─────────────────────────────────────────────────────────────────
export const buyers = pgTable('buyers', {
  id:            text('id').primaryKey(),           // Privy userId
  walletId:      text('wallet_id').notNull(),       // Privy wallet id
  walletAddress: text('wallet_address').notNull().unique(),
  publicKey:     text('public_key').notNull(),
  network:       text('network').notNull().default('mainnet'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  walletAddressIdx: index('buyer_wallet_address_idx').on(t.walletAddress),
}))