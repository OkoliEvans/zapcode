DO $$ BEGIN
 CREATE TYPE "public"."tx_status" AS ENUM('pending', 'confirmed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"business_name" text NOT NULL,
	"wallet_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"public_key" text NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"country" varchar(2) DEFAULT 'KE' NOT NULL,
	"network" text DEFAULT 'sepolia' NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_email_unique" UNIQUE("email"),
	CONSTRAINT "merchants_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"tx_hash" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"amount" numeric(28, 6) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDC' NOT NULL,
	"status" "tx_status" DEFAULT 'pending' NOT NULL,
	"block_number" text,
	"note" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "transactions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_wallet_address_idx" ON "merchants" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_merchant_id_idx" ON "transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_hash_idx" ON "transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_detected_at_idx" ON "transactions" USING btree ("detected_at");