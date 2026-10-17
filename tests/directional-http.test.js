import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { createApp } from "../server/app.js";
import { hash } from "../server/core.js";
import { recordDemoTick } from "../server/directional.js";
test("demo API authenticates, isolates virtual money, ignores forged outcomes and enforces admin permissions", async () => {
  const db = await database(null, "memory://");
  let server;
  try {
    await db.query(
      "INSERT INTO users(id,uid,email,verified) VALUES('http-user','OX-56781234','http@example.invalid',TRUE)",
    );
    await db.query(
      "INSERT INTO sessions(hash,user_id,csrf,expires_at) VALUES($1,'http-user','csrf',now()+interval '1 hour')",
      [hash("demo-http-session")],
    );
    server = createApp(
      db,
      {
        APP_ORIGIN: "http://localhost:4340",
        ENCRYPTION_KEY: "a".repeat(64),
      },
      { demoEnabled: true },
    ).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    async function call(path, body, session = true, extra = {}) {
      const r = await fetch(base + "/api" + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: "http://localhost:4340",
          "Content-Type": "application/json",
          ...(session
            ? { Cookie: "sid=demo-http-session", "X-CSRF-Token": "csrf" }
            : {}),
          ...extra,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    }
    assert.equal((await call("/demo/account", null, false)).status, 401);
    const account = await call("/demo/account");
    assert.equal(account.data.available, "10000.00");
    assert.equal(account.data.virtual, true);
    assert.equal((await call("/admin/demo")).status, 403);
    for (const path of [
      "/orders",
      "/withdrawals",
      "/deposit/requests",
      "/admin/adjustments",
    ])
      assert.equal((await call(path, {})).data.error, "REAL_MONEY_DISABLED");
    await recordDemoTick(db, "XAUUSD", Date.now(), "100", Date.now());
    const body = {
      asset: "XAUUSD",
      direction: "UP",
      amount: "10",
      duration: 60,
      payout: 999,
      open_price: 1,
      status: "won",
      expires_ms: 1,
    };
    const denied = await call(
      "/demo/positions",
      { ...body, account: "real" },
      true,
      { "Idempotency-Key": "http-main-denied" },
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.data.error, "REAL_MONEY_DISABLED");
    const opened = await call("/demo/positions", body, true, {
      "Idempotency-Key": "http-repeat",
    });
    assert.equal(opened.status, 201);
    assert.equal(opened.data.payout, "87.00");
    assert.equal(opened.data.open_price, "100.00000000");
    assert.ok(Number(opened.data.expires_ms) > Date.now() + 50000);
    const repeat = await call("/demo/positions", body, true, {
      "Idempotency-Key": "http-repeat",
    });
    assert.equal(repeat.data.id, opened.data.id);
    assert.equal((await call("/demo/account")).data.available, "9990.00");
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM accounts")).rows[0].n,
      0,
    );
    assert.equal((await call("/demo/positions")).data.items.length, 1);
    assert.equal((await call("/demo/market")).data.simulated, true);
    await db.query("UPDATE users SET role='admin' WHERE id='http-user'");
    assert.equal((await call("/admin/demo")).status, 403);
    await db.query("UPDATE users SET totp_enabled=TRUE WHERE id='http-user'");
    assert.equal((await call("/admin/demo")).status, 200);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
  }
});

test("normal deployment disables virtual account grants and virtual order APIs", async () => {
  const db = await database(null, "memory://");
  let server;
  try {
    server = createApp(db, {
      APP_ORIGIN: "http://localhost:4340",
      ENCRYPTION_KEY: "a".repeat(64),
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of [
      "/api/demo/account",
      "/api/demo/positions",
      "/api/demo/ledger",
    ]) {
      const r = await fetch(base + path);
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error, "DEMO_DISABLED");
    }
    const r = await fetch(base + "/api/demo/positions", {
      method: "POST",
      headers: {
        Origin: "http://localhost:4340",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: "10",
        direction: "UP",
        asset: "BTCUSD",
        duration: 3,
      }),
    });
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, "DEMO_DISABLED");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM demo_accounts")).rows[0]
        .n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM demo_positions")).rows[0]
        .n,
      0,
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
  }
});
