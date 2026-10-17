import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { id } from "../server/core.js";
import {
  openDemo,
  settleDemo,
  recordDemoTick,
  ensureDemo,
  updateDemoSettings,
  simulationPrice,
  demoFeed,
} from "../server/directional.js";
import { previewReturn } from "../public/assets/directional-math.js";
let db,
  base = 1700000000000;
before(async () => {
  db = await database(null, "memory://");
  await db.query(
    "INSERT INTO users(id,uid,email,role) VALUES('admin-demo','OX-99998888','admin-demo@test.invalid','admin')",
  );
});
after(async () => db.close());
async function fixture() {
  const user = id();
  base += 100000;
  await db.query(
    "INSERT INTO users(id,uid,email,verified) VALUES($1,$2,$3,TRUE)",
    [user, "OX-" + String(base).slice(-8), user + "@test.invalid"],
  );
  await updateDemoSettings(db, "admin-demo", {
    payout: "87",
    minimum: "1",
    maximum: "20000",
    reason: "Reset fixture payout and limits",
  });
  await recordDemoTick(db, "XAUUSD", base, "100", base);
  return {
    user,
    at: base,
    body: { asset: "XAUUSD", direction: "UP", amount: "10", duration: 3 },
  };
}
for (const [direction, close, status, credit] of [
  ["UP", "101", "won", "18.70"],
  ["UP", "99", "lost", "0.00"],
  ["DOWN", "99", "won", "18.70"],
  ["DOWN", "101", "lost", "0.00"],
  ["UP", "100", "draw", "10.00"],
])
  test(`${direction} ${close}: ${status} settles exact stake and payout once`, async () => {
    const f = await fixture(),
      p = await openDemo(
        db,
        f.user,
        { ...f.body, direction },
        id(),
        () => f.at + 10,
      );
    await recordDemoTick(db, "XAUUSD", f.at + 3250, close, f.at + 3250);
    const r = await settleDemo(db, p.id, () => f.at + 3260);
    assert.equal(r.status, status);
    assert.equal(r.credit, credit);
    const again = await settleDemo(db, p.id, () => f.at + 9000);
    assert.equal(again.journal_id, r.journal_id);
    const a = await ensureDemo(db, f.user);
    assert.equal(
      a.find((a) => a.bucket === "available").balance,
      (10000 - 10 + Number(credit)).toFixed(2),
    );
    assert.equal(a.find((a) => a.bucket === "reserved").balance, "0.00");
  });
test("invalid/stale feed refunds, never invents a close or deducts a second stake", async () => {
  const f = await fixture(),
    p = await openDemo(db, f.user, f.body, id(), () => f.at + 10);
  assert.equal(await settleDemo(db, p.id, () => f.at + 3200), null);
  await recordDemoTick(db, "XAUUSD", f.at + 5000, "90", f.at + 5000);
  const r = await settleDemo(db, p.id, () => f.at + 6000);
  assert.equal(r.status, "invalid");
  assert.equal(r.close_price, null);
  assert.equal(r.credit, "10.00");
  assert.equal(
    (await ensureDemo(db, f.user)).find((a) => a.bucket === "available")
      .balance,
    "10000.00",
  );
  await assert.rejects(
    openDemo(db, f.user, f.body, id(), () => f.at + 7000),
    (e) => e.code === "FEED_UNAVAILABLE",
  );
});
test("first valid tick at/after expiry wins over later ticks; prices and results are immutable", async () => {
  const f = await fixture(),
    p = await openDemo(db, f.user, f.body, id(), () => f.at + 10);
  await recordDemoTick(db, "XAUUSD", f.at + 3000, "90", f.at + 3000);
  await recordDemoTick(db, "XAUUSD", f.at + 3250, "101", f.at + 3250);
  await recordDemoTick(db, "XAUUSD", f.at + 3500, "80", f.at + 3500);
  const r = await settleDemo(db, p.id, () => f.at + 3600);
  assert.equal(r.status, "won");
  assert.equal(Number(r.close_tick_ms), f.at + 3250);
  await assert.rejects(
    db.query("UPDATE demo_positions SET payout=100 WHERE id=$1", [p.id]),
  );
  await assert.rejects(
    db.query("UPDATE demo_ticks SET price=1 WHERE asset='XAUUSD'"),
  );
  await assert.rejects(db.query("DELETE FROM demo_results"));
  await assert.rejects(db.query("TRUNCATE demo_journals CASCADE"));
});
test("87% net gain rounds down to cents and settings changes affect only new positions", async () => {
  const f = await fixture(),
    first = await openDemo(
      db,
      f.user,
      { ...f.body, amount: "1.01" },
      id(),
      () => f.at + 10,
    );
  await updateDemoSettings(db, "admin-demo", {
    payout: "70",
    minimum: "1",
    maximum: "20000",
    reason: "New rules for future demo trades",
  });
  const second = await openDemo(db, f.user, f.body, id(), () => f.at + 11);
  assert.equal(first.payout, "87.00");
  assert.equal(second.payout, "70.00");
  await recordDemoTick(db, "XAUUSD", f.at + 3250, "101", f.at + 3250);
  const r = await settleDemo(db, first.id, () => f.at + 3300);
  assert.equal(r.credit, "1.88");
  assert.equal(r.profit, "0.87");
  assert.deepEqual(previewReturn("10", "87"), {
    stake: "10.00",
    profit: "8.70",
    credit: "18.70",
  });
  assert.equal(previewReturn("1.01", "87").profit, "0.87");
});
test("parallel clicks and requests cannot grant twice, settle twice or overdraw the virtual balance", async () => {
  const f = await fixture();
  const grant = await Promise.all([
    ensureDemo(db, f.user),
    ensureDemo(db, f.user),
  ]);
  assert.equal(
    grant[0].find((a) => a.bucket === "available").balance,
    "10000.00",
  );
  const key = id(),
    ps = await Promise.all([
      openDemo(db, f.user, f.body, key, () => f.at + 10),
      openDemo(db, f.user, f.body, key, () => f.at + 10),
    ]);
  assert.equal(ps[0].id, ps[1].id);
  await assert.rejects(
    openDemo(
      db,
      f.user,
      { ...f.body, direction: "DOWN" },
      key,
      () => f.at + 10,
    ),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  await recordDemoTick(db, "XAUUSD", f.at + 3250, "101", f.at + 3250);
  const rs = await Promise.all([
    settleDemo(db, ps[0].id, () => f.at + 3300),
    settleDemo(db, ps[0].id, () => f.at + 3300),
  ]);
  assert.equal(rs[0].journal_id, rs[1].journal_id);
  const g = await fixture(),
    attempts = await Promise.allSettled([
      openDemo(
        db,
        g.user,
        { ...g.body, amount: "6000" },
        id(),
        () => g.at + 10,
      ),
      openDemo(
        db,
        g.user,
        { ...g.body, amount: "6000" },
        id(),
        () => g.at + 10,
      ),
    ]);
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  assert.equal(
    (await ensureDemo(db, g.user)).find((a) => a.bucket === "available")
      .balance,
    "4000.00",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM accounts WHERE user_id=$1",
        [g.user],
      )
    ).rows[0].n,
    0,
  );
});
test("source health disables short durations when late and simulation prices are deterministic", async () => {
  const f = await fixture();
  const a = (await demoFeed(db, f.at + 700)).find((a) => a.symbol === "XAUUSD");
  assert.equal(a.durations.find((d) => d.seconds === 3).enabled, false);
  assert.equal(a.durations.find((d) => d.seconds === 15).enabled, true);
  assert.equal(
    (await demoFeed(db, f.at + 2000)).find((a) => a.symbol === "XAUUSD")
      .healthy,
    false,
  );
  assert.equal(
    simulationPrice("XAUUSD", f.at),
    simulationPrice("XAUUSD", f.at),
  );
  await assert.rejects(
    updateDemoSettings(db, "admin-demo", {
      payout: "garbage",
      minimum: "1",
      maximum: "10",
      reason: "Invalid payout check",
    }),
    (e) => e.code === "INVALID_FORM",
  );
});
