import { createHash } from "node:crypto";

// Atomic fixed-window counter shared by all Vercel instances. Failures fail closed.
export class PostgresRateStore {
  localKeys = false;
  constructor(db, prefix) {
    this.db = db;
    this.prefix = prefix;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  key(value) {
    return this.prefix + ":" + createHash("sha256").update(value).digest("hex");
  }
  async increment(key) {
    const result = await this.db.query(
      `INSERT INTO request_limits(key,hits,reset_at)
      VALUES($1,1,now()+($2::double precision * interval '1 millisecond'))
      ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN request_limits.reset_at<=now() THEN 1 ELSE request_limits.hits+1 END,
      reset_at=CASE WHEN request_limits.reset_at<=now() THEN excluded.reset_at ELSE request_limits.reset_at END
      RETURNING hits,reset_at`,
      [this.key(key), this.windowMs],
    );
    return {
      totalHits: Number(result.rows[0].hits),
      resetTime: new Date(result.rows[0].reset_at),
    };
  }
  async decrement(key) {
    await this.db.query(
      "UPDATE request_limits SET hits=GREATEST(0,hits-1) WHERE key=$1",
      [this.key(key)],
    );
  }
  async resetKey(key) {
    await this.db.query("DELETE FROM request_limits WHERE key=$1", [
      this.key(key),
    ]);
  }
}
