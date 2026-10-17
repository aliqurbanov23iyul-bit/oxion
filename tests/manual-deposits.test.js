import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import {
  saveMethod,
  submitDeposit,
  reviewDeposit,
} from "../server/manual-deposits.js";
test("manual deposits: validation, duplicate claims, concurrent review, immutable audit", async () => {
  const db = await database(null, "memory://");
  try {
    for (const [id, uid] of [
      ["a", "OX-11111111"],
      ["u", "OX-22222222"],
      ["v", "OX-33333333"],
    ])
      await db.query("INSERT INTO users(id,uid,email) VALUES($1,$2,$3)", [
        id,
        uid,
        id + "@test.invalid",
      ]);
    const method = await saveMethod(db, "a", {
      asset: "USDT",
      network: "BEP20",
      address: "0x" + "1".repeat(40),
      minimum: "10",
      confirmations: 15,
      active: true,
    });
    const b = {
      method: method.id,
      amount: "12.5",
      txid: "0x" + "a".repeat(64),
    };
    const r = await submitDeposit(db, "u", b);
    assert.equal((await submitDeposit(db, "u", b)).id, r.id);
    await assert.rejects(
      submitDeposit(db, "v", b),
      (e) => e.code === "IDEMPOTENCY_CONFLICT",
    );
    await assert.rejects(
      reviewDeposit(db, "a", r.id, {
        approve: true,
        reason: "verified transfer",
      }),
      (e) => e.code === "UNVERIFIED_DEPOSIT",
    );
    await Promise.all(
      [1, 2].map(() =>
        reviewDeposit(db, "a", r.id, {
          approve: true,
          verified: true,
          reason: "verified on blockchain",
        }),
      ),
    );
    assert.equal(
      (
        await db.query(
          "SELECT balance FROM accounts WHERE user_id='u' AND bucket='available'",
        )
      ).rows[0].balance,
      "12.500000000000000000",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM journals WHERE kind='admin_confirmed_deposit'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(db.query("DELETE FROM deposit_reviews"));
    await assert.rejects(
      reviewDeposit(db, "a", r.id, {
        approve: false,
        reason: "reject duplicate",
      }),
      (e) => e.code === "IDEMPOTENCY_CONFLICT",
    );
    const r2 = await submitDeposit(db, "u", {
      ...b,
      txid: "0x" + "b".repeat(64),
    });
    await reviewDeposit(db, "a", r2.id, {
      approve: false,
      reason: "not found on chain",
    });
    assert.equal(
      (
        await db.query(
          "SELECT balance FROM accounts WHERE user_id='u' AND bucket='available'",
        )
      ).rows[0].balance,
      "12.500000000000000000",
    );
  } finally {
    await db.close();
  }
});
