BEGIN;
SELECT pg_advisory_xact_lock(73629418);
-- Directional demo: entirely separate from crypto/real accounts.
CREATE TABLE IF NOT EXISTS demo_accounts(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),bucket TEXT NOT NULL CHECK(bucket IN ('available','reserved','house')),balance NUMERIC(38,2) NOT NULL DEFAULT 0,CHECK(user_id IS NULL OR balance>=0));
CREATE TABLE IF NOT EXISTS demo_journals(id TEXT PRIMARY KEY,reference TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,actor TEXT REFERENCES users(id),reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS demo_entries(id TEXT PRIMARY KEY,journal_id TEXT NOT NULL REFERENCES demo_journals(id),account_id TEXT NOT NULL REFERENCES demo_accounts(id),amount NUMERIC(38,2) NOT NULL,before_balance NUMERIC(38,2) NOT NULL,after_balance NUMERIC(38,2) NOT NULL);
CREATE TABLE IF NOT EXISTS demo_settings(id TEXT PRIMARY KEY,payout NUMERIC(6,2) NOT NULL CHECK(payout>=0 AND payout<=100),minimum NUMERIC(20,2) NOT NULL CHECK(minimum>0),maximum NUMERIC(20,2) NOT NULL CHECK(maximum>=minimum),actor TEXT REFERENCES users(id),reason TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
ALTER TABLE demo_settings ADD COLUMN IF NOT EXISTS version BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS demo_settings_version ON demo_settings(version);
INSERT INTO demo_settings(id,payout,minimum,maximum,reason) VALUES('initial-v1',87,1,1000,'Initial virtual demo settings') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS demo_ticks(asset TEXT NOT NULL,at_ms BIGINT NOT NULL,received_ms BIGINT NOT NULL,price NUMERIC(38,8) NOT NULL CHECK(price>0),source TEXT NOT NULL CHECK(source='simulation-v1'),PRIMARY KEY(asset,at_ms),CHECK(received_ms>=at_ms));
CREATE TABLE IF NOT EXISTS demo_positions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),uid TEXT NOT NULL,request_key TEXT NOT NULL,request_hash TEXT NOT NULL,asset TEXT NOT NULL,direction TEXT NOT NULL CHECK(direction IN ('UP','DOWN')),stake NUMERIC(20,2) NOT NULL CHECK(stake>0),payout NUMERIC(6,2) NOT NULL,settings_id TEXT NOT NULL REFERENCES demo_settings(id),opened_ms BIGINT NOT NULL,expires_ms BIGINT NOT NULL,open_price NUMERIC(38,8) NOT NULL,open_tick_ms BIGINT NOT NULL,source TEXT NOT NULL CHECK(source='simulation-v1'),close_grace_ms INTEGER NOT NULL DEFAULT 1500,CHECK(expires_ms>opened_ms),UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS demo_results(position_id TEXT PRIMARY KEY REFERENCES demo_positions(id),status TEXT NOT NULL CHECK(status IN ('won','lost','draw','invalid')),close_price NUMERIC(38,8),close_tick_ms BIGINT,close_received_ms BIGINT,credit NUMERIC(20,2) NOT NULL,profit NUMERIC(20,2) NOT NULL,reason TEXT NOT NULL,settled_ms BIGINT NOT NULL,journal_id TEXT NOT NULL REFERENCES demo_journals(id));
CREATE INDEX IF NOT EXISTS demo_due ON demo_positions(expires_ms);
CREATE OR REPLACE FUNCTION demo_account_identity() RETURNS trigger AS $$ BEGIN IF NEW.id<>OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.bucket<>OLD.bucket THEN RAISE EXCEPTION 'Demo account identity is immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS demo_identity ON demo_accounts;
CREATE TRIGGER demo_identity BEFORE UPDATE ON demo_accounts FOR EACH ROW EXECUTE FUNCTION demo_account_identity();
CREATE OR REPLACE FUNCTION demo_reconcile() RETURNS trigger AS $$ BEGIN IF (SELECT balance FROM demo_accounts WHERE id=NEW.id)<>(SELECT coalesce(sum(amount),0) FROM demo_entries WHERE account_id=NEW.id) THEN RAISE EXCEPTION 'Demo ledger mismatch'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS demo_reconcile_account ON demo_accounts;
CREATE CONSTRAINT TRIGGER demo_reconcile_account AFTER INSERT OR UPDATE ON demo_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION demo_reconcile();
CREATE OR REPLACE FUNCTION demo_balanced() RETURNS trigger AS $$ BEGIN IF (SELECT coalesce(sum(amount),0) FROM demo_entries WHERE journal_id=NEW.journal_id)<>0 THEN RAISE EXCEPTION 'Unbalanced demo journal'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS demo_balance_entries ON demo_entries;
CREATE CONSTRAINT TRIGGER demo_balance_entries AFTER INSERT ON demo_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION demo_balanced();
DO $$ DECLARE tbl TEXT; BEGIN FOREACH tbl IN ARRAY ARRAY['demo_journals','demo_entries','demo_settings','demo_positions','demo_results','demo_ticks'] LOOP EXECUTE format('DROP TRIGGER IF EXISTS demo_immutable ON %I',tbl);EXECUTE format('CREATE TRIGGER demo_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_finance()',tbl);EXECUTE format('DROP TRIGGER IF EXISTS demo_no_truncate ON %I',tbl);EXECUTE format('CREATE TRIGGER demo_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION immutable_finance()',tbl);END LOOP;END $$;
-- Future real-money valuation records have no public writing route.
CREATE TABLE IF NOT EXISTS real_conversion_receipts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),provider_event TEXT UNIQUE NOT NULL,crypto_asset TEXT NOT NULL,crypto_amount NUMERIC(38,18) NOT NULL,usd_rate NUMERIC(38,18) NOT NULL,fee_usd NUMERIC(38,8) NOT NULL,credited_usd NUMERIC(38,2) NOT NULL,denomination TEXT NOT NULL CHECK(denomination IN ('USD-internal','USDT')),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
DROP TRIGGER IF EXISTS real_receipt_immutable ON real_conversion_receipts;
CREATE TRIGGER real_receipt_immutable BEFORE UPDATE OR DELETE ON real_conversion_receipts FOR EACH ROW EXECUTE FUNCTION immutable_finance();

COMMIT;
