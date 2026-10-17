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
