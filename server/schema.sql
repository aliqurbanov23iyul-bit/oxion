CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, uid TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT, google_sub TEXT UNIQUE, verified BOOLEAN NOT NULL DEFAULT FALSE, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 language TEXT NOT NULL DEFAULT 'az', totp_secret TEXT, totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
CREATE OR REPLACE FUNCTION immutable_uid() RETURNS trigger AS $$ BEGIN
 IF NEW.uid <> OLD.uid THEN RAISE EXCEPTION 'UID is immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS protect_uid ON users;
CREATE TRIGGER protect_uid BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION immutable_uid();
CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),purpose TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),ip TEXT,agent TEXT);
CREATE TABLE IF NOT EXISTS login_history (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),ip TEXT,agent TEXT,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),asset TEXT NOT NULL,bucket TEXT NOT NULL CHECK(bucket IN ('available','locked','bonus','manual','custody','clearing','fees','adjustment')),balance NUMERIC(38,18) NOT NULL DEFAULT 0, CHECK(user_id IS NULL OR balance>=0));
CREATE TABLE IF NOT EXISTS journals (id TEXT PRIMARY KEY,reference TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,actor TEXT REFERENCES users(id),reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY,journal_id TEXT REFERENCES journals(id),account_id TEXT REFERENCES accounts(id),amount NUMERIC(38,18) NOT NULL, before_balance NUMERIC(38,18) NOT NULL,after_balance NUMERIC(38,18) NOT NULL);
CREATE OR REPLACE FUNCTION immutable_finance() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Financial records are append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS protect_journals ON journals;
CREATE TRIGGER protect_journals BEFORE UPDATE OR DELETE ON journals FOR EACH ROW EXECUTE FUNCTION immutable_finance();
DROP TRIGGER IF EXISTS protect_entries ON entries;
CREATE TRIGGER protect_entries BEFORE UPDATE OR DELETE ON entries FOR EACH ROW EXECUTE FUNCTION immutable_finance();
DROP TRIGGER IF EXISTS protect_entries_truncate ON entries;
CREATE TRIGGER protect_entries_truncate BEFORE TRUNCATE ON entries FOR EACH STATEMENT EXECUTE FUNCTION immutable_finance();
DROP TRIGGER IF EXISTS protect_journals_truncate ON journals;
CREATE TRIGGER protect_journals_truncate BEFORE TRUNCATE ON journals FOR EACH STATEMENT EXECUTE FUNCTION immutable_finance();
CREATE OR REPLACE FUNCTION reconcile_account() RETURNS trigger AS $$ BEGIN
 IF (SELECT balance FROM accounts WHERE id=NEW.id) <> (SELECT coalesce(sum(amount),0) FROM entries WHERE account_id=NEW.id) THEN RAISE EXCEPTION 'Account must reconcile to journal'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS check_account ON accounts;
CREATE CONSTRAINT TRIGGER check_account AFTER INSERT OR UPDATE ON accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reconcile_account();
CREATE OR REPLACE FUNCTION immutable_account_identity() RETURNS trigger AS $$ BEGIN
 IF NEW.id<>OLD.id OR NEW.asset<>OLD.asset OR NEW.bucket<>OLD.bucket OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Account identity is immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS protect_account_identity ON accounts;
CREATE TRIGGER protect_account_identity BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION immutable_account_identity();
CREATE OR REPLACE FUNCTION balanced_journal() RETURNS trigger AS $$ BEGIN
 IF EXISTS(SELECT a.asset FROM entries e JOIN accounts a ON a.id=e.account_id WHERE e.journal_id=NEW.journal_id GROUP BY a.asset HAVING sum(e.amount)<>0) THEN RAISE EXCEPTION 'Unbalanced journal'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS check_journal ON entries;
CREATE CONSTRAINT TRIGGER check_journal AFTER INSERT ON entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION balanced_journal();
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),request_key TEXT NOT NULL,request_hash TEXT NOT NULL,symbol TEXT NOT NULL,side TEXT NOT NULL,type TEXT NOT NULL,quantity NUMERIC(38,18) NOT NULL,price NUMERIC(38,18) NOT NULL,reserved NUMERIC(38,18) NOT NULL,filled NUMERIC(38,18) NOT NULL DEFAULT 0,status TEXT NOT NULL,provider_id TEXT,created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS order_quotes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,request_hash TEXT NOT NULL,payload JSONB NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS fills (id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),quantity NUMERIC(38,18),price NUMERIC(38,18),fee NUMERIC(38,18),created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE orders ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'local-simulation';
ALTER TABLE fills ADD COLUMN IF NOT EXISTS fee_asset TEXT NOT NULL DEFAULT 'USDT';
DROP TRIGGER IF EXISTS protect_fills ON fills;
CREATE TRIGGER protect_fills BEFORE UPDATE OR DELETE ON fills FOR EACH ROW EXECUTE FUNCTION immutable_finance();
DROP TRIGGER IF EXISTS protect_fills_truncate ON fills;
CREATE TRIGGER protect_fills_truncate BEFORE TRUNCATE ON fills FOR EACH STATEMENT EXECUTE FUNCTION immutable_finance();
CREATE OR REPLACE FUNCTION protect_closed_order() RETURNS trigger AS $$ BEGIN
 IF OLD.status IN ('filled','cancelled','rejected','expired') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Closed orders are immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS protect_closed_orders ON orders;
CREATE TRIGGER protect_closed_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_closed_order();
CREATE TABLE IF NOT EXISTS execution_jobs (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),client_order_id TEXT UNIQUE NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued',cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
 attempts INTEGER NOT NULL DEFAULT 0,next_at TIMESTAMPTZ NOT NULL DEFAULT now(),lease_until TIMESTAMPTZ,
 last_error TEXT,lease_token TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE execution_jobs ADD COLUMN IF NOT EXISTS lease_token TEXT;
CREATE TABLE IF NOT EXISTS deposits (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),asset TEXT NOT NULL,network TEXT NOT NULL,amount NUMERIC(38,18) NOT NULL,txid TEXT,status TEXT NOT NULL,confirmations INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS protect_deposits ON deposits;
CREATE TRIGGER protect_deposits BEFORE UPDATE OR DELETE ON deposits FOR EACH ROW EXECUTE FUNCTION immutable_finance();
CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),request_key TEXT NOT NULL,asset TEXT NOT NULL,network TEXT NOT NULL,address TEXT NOT NULL,memo TEXT,amount NUMERIC(38,18) NOT NULL,fee NUMERIC(38,18) NOT NULL,status TEXT NOT NULL,txid TEXT,created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),subject TEXT NOT NULL,message TEXT NOT NULL,reply TEXT,status TEXT DEFAULT 'open',created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'account';
CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY,active BOOLEAN DEFAULT FALSE,sort_order INTEGER DEFAULT 0,starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,image TEXT,link TEXT NOT NULL DEFAULT '/promotion-details.html',texts JSONB NOT NULL,terms JSONB NOT NULL DEFAULT '{}');
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'bonus';
INSERT INTO campaigns(id,texts) VALUES ('first-deposit','{"az":{"title":"İlk depozitinə 200%-dək bonus","subtitle":"Uyğunluq və kampaniya şərtləri tətbiq olunur."},"en":{"title":"Up to 200% on your first deposit","subtitle":"Eligibility and campaign terms apply."},"tr":{"title":"İlk yatırmaya %200’e kadar bonus","subtitle":"Uygunluk ve kampanya koşulları geçerlidir."},"ru":{"title":"До 200% за первый депозит","subtitle":"Действуют условия кампании."}}') ON CONFLICT DO NOTHING;
INSERT INTO campaigns(id,kind,active,sort_order,link,texts) VALUES
('assets','informational',TRUE,10,'/markets.html','{"az":{"title":"15 kriptovalyuta. Bir platforma.","subtitle":"Sevdiyin aktivləri bir yerdə kəşf et."},"en":{"title":"15 cryptocurrencies. One platform.","subtitle":"Discover your favourite assets in one place."},"tr":{"title":"15 kripto para. Tek platform.","subtitle":"Sevdiğin varlıkları tek yerde keşfet."},"ru":{"title":"15 криптовалют. Одна платформа.","subtitle":"Любимые активы в одном месте."}}'),
('live-markets','informational',TRUE,20,'/trade.html','{"az":{"title":"Bazarları canlı izlə.","subtitle":"Qiymətlər, qrafiklər və bazarın ritmi."},"en":{"title":"Follow the markets live.","subtitle":"Prices, charts and the rhythm of the market."},"tr":{"title":"Piyasaları canlı izle.","subtitle":"Fiyatlar, grafikler ve piyasanın ritmi."},"ru":{"title":"Следите за рынками.","subtitle":"Цены, графики и ритм рынка."}}'),
('first-spot','informational',FALSE,30,'/trade.html','{"az":{"title":"OXION ilə ilk spot əməliyyatına başla.","subtitle":"Yerli sınaqda spot ticarəti kəşf et."},"en":{"title":"Discover your first spot trade with OXION.","subtitle":"Explore spot trading in the local test environment."},"tr":{"title":"OXION ile ilk spot işlemini keşfet.","subtitle":"Yerel test ortamında spot işlemleri keşfet."},"ru":{"title":"Первая спотовая сделка с OXION.","subtitle":"Изучайте спотовую торговлю в тестовой среде."}}')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY,hits INTEGER NOT NULL,reset_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS request_limits_expiry ON request_limits(reset_at);
CREATE TABLE IF NOT EXISTS oxion_schema (version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO oxion_schema(version) VALUES('2026-10-vercel-1') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS deposit_methods (
 id TEXT PRIMARY KEY, asset TEXT NOT NULL, network TEXT NOT NULL, address TEXT NOT NULL,
 memo TEXT NOT NULL DEFAULT '', minimum NUMERIC(38,18) NOT NULL CHECK(minimum>0),
 confirmations INTEGER NOT NULL CHECK(confirmations>0), active BOOLEAN NOT NULL DEFAULT FALSE,
 actor TEXT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deposit_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), method_id TEXT NOT NULL REFERENCES deposit_methods(id),
 asset TEXT NOT NULL, network TEXT NOT NULL, address TEXT NOT NULL, memo TEXT NOT NULL,
 amount NUMERIC(38,18) NOT NULL CHECK(amount>0), txid TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(network,txid)
);
CREATE TABLE IF NOT EXISTS deposit_reviews (
 request_id TEXT PRIMARY KEY REFERENCES deposit_requests(id), actor TEXT NOT NULL REFERENCES users(id),
 approved BOOLEAN NOT NULL, reason TEXT NOT NULL, journal_id TEXT REFERENCES journals(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS protect_deposit_requests ON deposit_requests;
CREATE TRIGGER protect_deposit_requests BEFORE UPDATE OR DELETE ON deposit_requests FOR EACH ROW EXECUTE FUNCTION immutable_finance();
DROP TRIGGER IF EXISTS protect_deposit_reviews ON deposit_reviews;
CREATE TRIGGER protect_deposit_reviews BEFORE UPDATE OR DELETE ON deposit_reviews FOR EACH ROW EXECUTE FUNCTION immutable_finance();
ALTER TABLE deposit_methods ADD COLUMN IF NOT EXISTS qr_image TEXT;
ALTER TABLE deposit_methods ADD COLUMN IF NOT EXISTS minimum_usd NUMERIC(38,18) NOT NULL DEFAULT 10 CHECK(minimum_usd>=10);
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS usd_price NUMERIC(38,18);
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS usd_value NUMERIC(38,18);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE deposit_requests ALTER COLUMN txid DROP NOT NULL;
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deposit_request_key ON deposit_requests(user_id,request_key) WHERE request_key IS NOT NULL;
ALTER TABLE deposit_reviews ADD COLUMN IF NOT EXISTS txid TEXT;
ALTER TABLE deposit_reviews ADD COLUMN IF NOT EXISTS network TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deposit_review_transfer ON deposit_reviews(network,txid) WHERE approved=TRUE AND txid IS NOT NULL;
