import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { database } from "../server/db.js";
import {
  openDemo,
  settleDemo,
  recordDemoTick,
  ensureDemo,
} from "../server/directional.js";
test("demo positions survive database restart; valid results and outage refunds reconcile once", async () => {
  const path = await mkdtemp(join(tmpdir(), "oxion-demo-restart-"));
  let db;
  try {
    db = await database(null, path);
    await db.query(
      "INSERT INTO users(id,uid,email) VALUES('u','OX-55556666','restart@test.invalid')",
    );
    const at = 1701000000000;
    await recordDemoTick(db, "XAUUSD", at, "100", at);
    const body = {
      asset: "XAUUSD",
      direction: "UP",
      amount: "10",
      duration: 3,
    };
    const win = await openDemo(db, "u", body, "restart-first", () => at + 10);
    const outage = await openDemo(
      db,
      "u",
      { ...body, asset: "XAUUSD", duration: 5 },
      "restart-second",
      () => at + 11,
    );
    await recordDemoTick(db, "XAUUSD", at + 3250, "101", at + 3250);
    await db.close();
    db = null;
    db = await database(null, path);
    const r = await settleDemo(db, win.id, () => at + 10000),
      invalid = await settleDemo(db, outage.id, () => at + 10000);
    assert.equal(r.status, "won");
    assert.equal(invalid.status, "invalid");
    await settleDemo(db, win.id, () => at + 11000);
    assert.equal(
      (await ensureDemo(db, "u")).find((a) => a.bucket === "available").balance,
      "10008.70",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM demo_journals WHERE kind LIKE 'position_won' OR kind LIKE 'position_invalid'",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    if (db) await db.close();
    const absolute = resolve(path);
    if (
      !absolute.startsWith(resolve(tmpdir()) + sep) ||
      !basename(absolute).startsWith("oxion-demo-restart-")
    )
      throw Error("Unsafe cleanup");
    await rm(absolute, { recursive: true, force: true });
  }
});
