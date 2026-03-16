CREATE TABLE IF NOT EXISTS "buyers" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"public_key" text NOT NULL,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyers_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_wallet_address_idx" ON "buyers" USING btree ("wallet_address");