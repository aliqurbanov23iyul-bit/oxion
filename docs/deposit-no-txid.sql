ALTER TABLE deposit_requests ALTER COLUMN txid DROP NOT NULL;
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deposit_request_key ON deposit_requests(user_id,request_key) WHERE request_key IS NOT NULL;
ALTER TABLE deposit_reviews ADD COLUMN IF NOT EXISTS txid TEXT;
ALTER TABLE deposit_reviews ADD COLUMN IF NOT EXISTS network TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deposit_review_transfer ON deposit_reviews(network,txid) WHERE approved=TRUE AND txid IS NOT NULL;
