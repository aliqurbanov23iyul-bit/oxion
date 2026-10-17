import { D, id, hash, fail, lockUser } from "./core.js";
export const DEMO_SOURCE = "simulation-v1",
  TICK_MS = 250,
  CLOSE_GRACE_MS = 1500;
export const DURATIONS = [3, 5, 15, 30, 60, 300];
export const demoAssets = [
  {
    symbol: "XAUUSD",
    label: "XAU / USD",
    category: "metals",
    base: "2635",
    amplitude: "3.7",
    phase: 2,
  },
  {
    symbol: "XAGUSD",
    label: "XAG / USD",
    category: "metals",
    base: "31.5",
    amplitude: ".1",
    phase: 4,
  },
  {
    symbol: "BTCUSD",
    label: "BTC / USD",
    category: "crypto",
    base: "81000",
    amplitude: "180",
    phase: 7,
  },
  {
    symbol: "ETHUSD",
    label: "ETH / USD",
    category: "crypto",
    base: "3100",
    amplitude: "9",
    phase: 3,
  },
  {
    symbol: "EURUSD",
    label: "EUR / USD",
    category: "forex",
    base: "1.08",
    amplitude: ".0012",
    phase: 11,
  },
  {
    symbol: "GBPUSD",
    label: "GBP / USD",
    category: "forex",
    base: "1.29",
    amplitude: ".0013",
    phase: 13,
  },
  {
    symbol: "AAPL",
    label: "AAPL",
    category: "stocks",
    base: "225",
    amplitude: ".8",
    phase: 17,
  },
  {
    symbol: "MSFT",
    label: "MSFT",
    category: "stocks",
    base: "420",
    amplitude: "1.3",
    phase: 19,
  },
];
export function simulationPrice(asset, at) {
  const a = demoAssets.find((a) => a.symbol === asset);
  if (!a) fail(400, "UNSUPPORTED_PAIR");
  // A deterministic, public simulation function; no user/account inputs or outcome RNG.
  const seconds = (Math.floor(at / TICK_MS) * TICK_MS - 1700000000000) / 1000;
  const wave =
    Math.sin(seconds / 8 + a.phase) * 0.6 +
    Math.sin(seconds / 2.7 + a.phase * 2) * 0.25 +
    Math.sin(seconds / 29 + a.phase) * 0.15;
  return new D(a.base)
    .plus(new D(a.amplitude).mul(wave.toFixed(12)))
    .toFixed(8, D.ROUND_HALF_UP);
}
const cents = (v) => new D(v).toDecimalPlaces(2, D.ROUND_DOWN);
const stake = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{1,8}(\.\d{1,2})?$/.test(v) ||
    !new D(v).gt(0)
  )
    fail(400, "INVALID_AMOUNT");
  return cents(v);
};
async function ledger(tx, reference, kind, lines, actor = null, reason = null) {
  const old = (
    await tx.query("SELECT id FROM demo_journals WHERE reference=$1", [
      reference,
    ])
  ).rows[0];
  if (old) return old.id;
  const grouped = new Map();
  for (const [account, value] of lines)
    grouped.set(account, (grouped.get(account) || new D(0)).plus(value));
  if (![...grouped.values()].reduce((s, n) => s.plus(n), new D(0)).eq(0))
    fail(400, "UNBALANCED_JOURNAL");
  const jid = id();
  await tx.query(
    "INSERT INTO demo_journals(id,reference,kind,actor,reason) VALUES($1,$2,$3,$4,$5)",
    [jid, reference, kind, actor, reason],
  );
  for (const [key, value] of [...grouped].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const a = (
      await tx.query("SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE", [
        key,
      ])
    ).rows[0];
    if (!a) fail(500, "ACCOUNT_MISSING");
    const after = new D(a.balance).plus(value);
    if (a.user_id && after.lt(0)) fail(409, "INSUFFICIENT_BALANCE");
    await tx.query("UPDATE demo_accounts SET balance=$1 WHERE id=$2", [
      after.toFixed(2),
      key,
    ]);
    await tx.query(
      "INSERT INTO demo_entries(id,journal_id,account_id,amount,before_balance,after_balance) VALUES($1,$2,$3,$4,$5,$6)",
      [id(), jid, key, value.toFixed(2), a.balance, after.toFixed(2)],
    );
  }
  return jid;
}
async function accounts(tx, user) {
  for (const [key, u, bucket] of [
    [user + ":available", user, "available"],
    [user + ":reserved", user, "reserved"],
    ["house", null, "house"],
  ])
    await tx.query(
      "INSERT INTO demo_accounts(id,user_id,bucket) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [key, u, bucket],
    );
  await ledger(
    tx,
    "grant:" + user,
    "virtual_grant",
    [
      [user + ":available", new D(10000)],
      ["house", new D(-10000)],
    ],
    null,
    "One-time virtual demo grant; not real USD",
  );
}
export async function ensureDemo(db, user) {
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    await accounts(tx, user);
    return (
      await tx.query(
        "SELECT bucket,balance FROM demo_accounts WHERE user_id=$1 ORDER BY bucket",
        [user],
      )
    ).rows;
  });
}
export async function demoSettings(db) {
  return (
    await db.query("SELECT * FROM demo_settings ORDER BY version DESC LIMIT 1")
  ).rows[0];
}
export async function updateDemoSettings(db, actor, b) {
  if (typeof b.payout !== "string" || !/^\d{1,3}(\.\d{1,2})?$/.test(b.payout))
    fail(400, "INVALID_FORM");
  const payout = new D(b.payout),
    min = stake(b.minimum),
    max = stake(b.maximum);
  if (
    !payout.isFinite() ||
    payout.lt(0) ||
    payout.gt(100) ||
    payout.decimalPlaces() > 2 ||
    min.gt(max) ||
    max.gt(100000) ||
    typeof b.reason !== "string" ||
    b.reason.trim().length < 8 ||
    b.reason.length > 500
  )
    fail(400, "INVALID_FORM");
  return (
    await db.query(
      "INSERT INTO demo_settings(id,payout,minimum,maximum,actor,reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        id(),
        payout.toFixed(2),
        min.toFixed(2),
        max.toFixed(2),
        actor,
        b.reason,
      ],
    )
  ).rows[0];
}
export async function recordDemoTick(db, asset, at, price, received = at) {
  if (
    !demoAssets.some((a) => a.symbol === asset) ||
    !Number.isSafeInteger(at) ||
    !Number.isSafeInteger(received) ||
    received < at ||
    received - at > 1000 ||
    !new D(price).isFinite() ||
    !new D(price).gt(0)
  )
    fail(400, "INVALID_DEMO_TICK");
  await db.query(
    "INSERT INTO demo_ticks(asset,at_ms,received_ms,price,source) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [
      asset,
      at,
      received,
      new D(price).toFixed(8, D.ROUND_HALF_UP),
      DEMO_SOURCE,
    ],
  );
}
export async function demoFeed(db, now = Date.now()) {
  const ticks = (
    await db.query(
      "SELECT DISTINCT ON(asset) asset,at_ms,received_ms,price,source FROM demo_ticks ORDER BY asset,at_ms DESC",
    )
  ).rows;
  return demoAssets.map((a) => {
    const tick = ticks.find((t) => t.asset === a.symbol),
      age = tick ? now - Number(tick.at_ms) : null;
    const healthy = age !== null && age >= 0 && age <= 1000;
    return {
      symbol: a.symbol,
      label: a.label,
      category: a.category,
      source: DEMO_SOURCE,
      simulated: true,
      market_status: "simulated",
      price: tick?.price || null,
      tick_ms: tick ? Number(tick.at_ms) : null,
      age_ms: age,
      healthy,
      durations: DURATIONS.map((seconds) => ({
        seconds,
        enabled: healthy && (seconds >= 15 || age <= 500),
        reason: healthy
          ? seconds < 15 && age > 500
            ? "FEED_TOO_SLOW"
            : null
          : "FEED_UNAVAILABLE",
      })),
    };
  });
}
export async function openDemo(db, user, b, key, clock = Date.now) {
  if (typeof key !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(key))
    fail(400, "IDEMPOTENCY_CONFLICT");
  const v = stake(b.amount);
  if (
    !demoAssets.some((a) => a.symbol === b.asset) ||
    !["UP", "DOWN"].includes(b.direction) ||
    !DURATIONS.includes(b.duration)
  )
    fail(400, "INVALID_FORM");
  const fingerprint = hash(
    JSON.stringify({
      asset: b.asset,
      direction: b.direction,
      amount: v.toFixed(2),
      duration: b.duration,
    }),
  );
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = (
      await tx.query(
        "SELECT * FROM demo_positions WHERE user_id=$1 AND request_key=$2",
        [user, key],
      )
    ).rows[0];
    if (old) {
      if (old.request_hash !== fingerprint) fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    await accounts(tx, user);
    const cfg = await demoSettings(tx);
    if (b.settings_id && b.settings_id !== cfg.id)
      fail(409, "DEMO_RULES_CHANGED");
    const count = (
      await tx.query(
        "SELECT count(*)::int AS n FROM demo_positions p LEFT JOIN demo_results r ON r.position_id=p.id WHERE p.user_id=$1 AND r.position_id IS NULL",
        [user],
      )
    ).rows[0].n;
    if (count >= 20) fail(409, "DEMO_MAX_OPEN");
    if (v.lt(cfg.minimum) || v.gt(cfg.maximum)) fail(400, "DEMO_LIMIT");
    const now = clock(),
      tick = (
        await tx.query(
          "SELECT * FROM demo_ticks WHERE asset=$1 AND at_ms<=$2 ORDER BY at_ms DESC LIMIT 1",
          [b.asset, now],
        )
      ).rows[0];
    const maxAge = b.duration < 15 ? 500 : 1000;
    if (
      !tick ||
      now - Number(tick.at_ms) > maxAge ||
      Number(tick.received_ms) > now
    )
      fail(503, "FEED_UNAVAILABLE");
    const u = (await tx.query("SELECT uid FROM users WHERE id=$1", [user]))
        .rows[0],
      pid = id();
    await ledger(
      tx,
      "reserve:" + pid,
      "position_reserve",
      [
        [user + ":available", v.neg()],
        [user + ":reserved", v],
      ],
      user,
    );
    const r = await tx.query(
      "INSERT INTO demo_positions(id,user_id,uid,request_key,request_hash,asset,direction,stake,payout,settings_id,opened_ms,expires_ms,open_price,open_tick_ms,source,close_grace_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",
      [
        pid,
        user,
        u.uid,
        key,
        fingerprint,
        b.asset,
        b.direction,
        v.toFixed(2),
        cfg.payout,
        cfg.id,
        now,
        now + b.duration * 1000,
        tick.price,
        tick.at_ms,
        DEMO_SOURCE,
        CLOSE_GRACE_MS,
      ],
    );
    return r.rows[0];
  });
}
export async function settleDemo(db, pid, clock = Date.now) {
  return db.transaction(async (tx) => {
    const p = (
      await tx.query("SELECT * FROM demo_positions WHERE id=$1 FOR UPDATE", [
        pid,
      ])
    ).rows[0];
    if (!p) fail(404, "NOT_FOUND");
    const old = (
      await tx.query("SELECT * FROM demo_results WHERE position_id=$1", [pid])
    ).rows[0];
    if (old) return old;
    const now = clock(),
      expiry = Number(p.expires_ms),
      deadline = expiry + p.close_grace_ms;
    if (now < expiry) return null;
    const tick = (
      await tx.query(
        "SELECT * FROM demo_ticks WHERE asset=$1 AND at_ms>=$2 AND at_ms<=$3 AND received_ms<=$3 AND received_ms<=$4 ORDER BY at_ms LIMIT 1",
        [p.asset, expiry, deadline, now],
      )
    ).rows[0];
    if (!tick && now < deadline) return null;
    await lockUser(tx, p.user_id);
    const v = new D(p.stake),
      comparison = tick ? new D(tick.price).cmp(p.open_price) : null;
    const status = !tick
      ? "invalid"
      : comparison === 0
        ? "draw"
        : (p.direction === "UP" ? comparison > 0 : comparison < 0)
          ? "won"
          : "lost";
    const gain = cents(v.mul(p.payout).div(100)),
      credit =
        status === "won" ? v.plus(gain) : status === "lost" ? new D(0) : v;
    const lines = [
      [p.user_id + ":reserved", v.neg()],
      ["house", v],
    ];
    if (credit.gt(0))
      lines.push(["house", credit.neg()], [p.user_id + ":available", credit]);
    const reason = tick
      ? "FIRST_VALID_TICK_AT_OR_AFTER_EXPIRY"
      : "NO_VALID_TICK_WITHIN_GRACE";
    const jid = await ledger(
      tx,
      "settle:" + pid,
      "position_" + status,
      lines,
      null,
      reason,
    );
    return (
      await tx.query(
        "INSERT INTO demo_results(position_id,status,close_price,close_tick_ms,close_received_ms,credit,profit,reason,settled_ms,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
        [
          pid,
          status,
          tick?.price || null,
          tick?.at_ms || null,
          tick?.received_ms || null,
          credit.toFixed(2),
          credit.minus(v).toFixed(2),
          reason,
          now,
          jid,
        ],
      )
    ).rows[0];
  });
}
export async function settleDue(db, now = Date.now(), user = null) {
  const rows = (
    await db.query(
      "SELECT p.id FROM demo_positions p LEFT JOIN demo_results r ON r.position_id=p.id WHERE r.position_id IS NULL AND p.expires_ms<=$1 AND ($2::text IS NULL OR p.user_id=$2) ORDER BY p.expires_ms LIMIT 100",
      [now, user],
    )
  ).rows;
  for (const p of rows) await settleDemo(db, p.id, () => now);
}
export function startDemoEngine(
  db,
  { clock = Date.now, interval = TICK_MS } = {},
) {
  let busy = false,
    closed = false,
    last = 0,
    job = Promise.resolve();
  const pulse = () => {
    if (busy || closed) return job;
    busy = true;
    job = (async () => {
      try {
        const received = clock(),
          at = Math.floor(received / TICK_MS) * TICK_MS;
        if (at !== last) {
          for (const a of demoAssets)
            await recordDemoTick(
              db,
              a.symbol,
              at,
              simulationPrice(a.symbol, at),
              received,
            );
          last = at;
        }
        await settleDue(db, clock());
      } catch (e) {
        if (!closed) console.error("Demo engine:", e.code || e.message);
      } finally {
        busy = false;
      }
    })();
    return job;
  };
  const timer = setInterval(pulse, interval);
  timer.unref();
  pulse();
  return {
    pulse,
    stop: async () => {
      closed = true;
      clearInterval(timer);
      await job;
    },
  };
}
