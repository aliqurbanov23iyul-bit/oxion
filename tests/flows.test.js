import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { createApp } from "../server/app.js";
import { id, token, hash, passwordCheck, D } from "../server/core.js";
import {
  confirmedDeposit,
  adjustment,
  withdrawal,
  createOrder,
  fillOrder,
  cancelOrder,
} from "../server/finance.js";
import { readdir, readFile } from "node:fs/promises";
import * as OTPAuth from "otpauth";
import { vault } from "../server/core.js";
import { saveQuote, acceptQuote, calculateQuote } from "../server/quotes.js";
let db, server, base, uid, admin;
const origin = "http://localhost:4317";
let cookie = "",
  csrf = "";
async function call(
  path,
  { method = "GET", body, session = true, headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(session && cookie ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { r, data };
}
before(async () => {
  db = await database(null, "memory://");
  server = createApp(
    db,
    {
      APP_ORIGIN: origin,
      ENCRYPTION_KEY: "a".repeat(64),
    },
    { markets: async () => catalog, legacySpot: true },
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  admin = id();
  await db.query(
    "INSERT INTO users(id,uid,email,verified,role) VALUES($1,'OX-10000000','admin@test.invalid',TRUE,'admin')",
    [admin],
  );
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});
test("signup refuses missing mandatory terms consent", async () => {
  const r = await call("/api/auth/signup", {
    method: "POST",
    body: {
      email: "no-consent@example.invalid",
      password: "A-long-test-password-123",
    },
  });
  assert.equal(r.r.status, 400);
  assert.equal(r.data.error, "TERMS_REQUIRED");
  assert.equal(
    (
      await db.query(
        "SELECT id FROM users WHERE email='no-consent@example.invalid'",
      )
    ).rows.length,
    0,
  );
});
test("signup hashes password, assigns public UID, verifies only once, login and CSRF", async () => {
  const { r, data } = await call("/api/auth/signup", {
    method: "POST",
    body: {
      email: "tester@example.invalid",
      terms: true,
      password: "A-long-test-password-123",
    },
  });
  assert.equal(r.status, 201);
  assert.equal(data.delivery, "not-configured");
  const u = (
    await db.query("SELECT * FROM users WHERE email='tester@example.invalid'")
  ).rows[0];
  uid = u.id;
  assert.match(u.uid, /^OX-\d{8}$/);
  assert.notEqual(u.password, "A-long-test-password-123");
  assert.ok(await passwordCheck("A-long-test-password-123", u.password));
  const files = await readdir(".local/mail");
  let raw;
  for (const f of files) {
    const txt = await readFile(".local/mail/" + f, "utf8");
    if (txt.includes("tester@example.invalid"))
      raw = txt.match(/token=([a-f0-9]{64})/)[1];
  }
  assert.ok(raw);
  assert.equal(
    (await call("/api/auth/verify", { method: "POST", body: { token: raw } })).r
      .status,
    200,
  );
  assert.equal(
    (await call("/api/auth/verify", { method: "POST", body: { token: raw } })).r
      .status,
    400,
  );
  const l = await call("/api/auth/login", {
    method: "POST",
    body: { email: u.email, password: "A-long-test-password-123" },
  });
  assert.equal(l.r.status, 200);
  cookie = l.r.headers.get("set-cookie").split(";")[0];
  csrf = l.data.csrf;
  assert.ok(l.r.headers.get("set-cookie").includes("HttpOnly"));
  assert.equal((await call("/api/me")).data.user.uid, u.uid);
  assert.equal(
    (
      await call("/api/profile", {
        method: "PATCH",
        body: { language: "en" },
        headers: { "X-CSRF-Token": "bad" },
      })
    ).r.status,
    403,
  );
});
test("support requires login, validates categories and returns a persistent private ticket", async () => {
  const body = {
    category: "google",
    subject: "Google sign-in",
    message: "Please explain the Google setup.",
  };
  assert.equal(
    (await call("/api/tickets", { method: "POST", body, session: false })).r
      .status,
    401,
  );
  assert.equal(
    (
      await call("/api/tickets", {
        method: "POST",
        body: { ...body, category: "invalid" },
      })
    ).r.status,
    400,
  );
  const created = await call("/api/tickets", { method: "POST", body });
  assert.equal(created.r.status, 201);
  assert.equal(created.data.status, "open");
  assert.ok(created.data.id);
  const item = (await call("/api/tickets")).data.items.find(
    (x) => x.id === created.data.id,
  );
  assert.equal(item.category, "google");
  assert.equal(item.user_id, uid);
});
test("configured Google OAuth explicitly asks for account selection", async () => {
  const oauth = createApp(db, {
    APP_ORIGIN: origin,
    ENCRYPTION_KEY: "a".repeat(64),
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
  }).listen(0, "127.0.0.1");
  await new Promise((r) => oauth.once("listening", r));
  try {
    const r = await fetch(
      "http://127.0.0.1:" + oauth.address().port + "/api/auth/google",
      { redirect: "manual" },
    );
    assert.equal(r.status, 302);
    const u = new URL(r.headers.get("location"));
    assert.equal(u.searchParams.get("prompt"), "select_account");
    assert.equal(
      u.searchParams.get("redirect_uri"),
      origin + "/api/auth/google/callback",
    );
    assert.ok(u.searchParams.get("state"));
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  } finally {
    await new Promise((r) => oauth.close(r));
  }
});
test("UID immutable; auth and admin permissions enforced", async () => {
  await assert.rejects(
    db.query("UPDATE users SET uid='OX-99999999' WHERE id=$1", [uid]),
  );
  assert.equal((await call("/api/wallet", { session: false })).r.status, 401);
  assert.equal((await call("/api/admin/users")).r.status, 403);
  assert.equal((await call("/admin/", { session: false })).r.status, 401);
  assert.equal(
    (
      await call("/api/withdrawals", {
        method: "POST",
        body: {},
        headers: { Origin: "https://evil.invalid" },
      })
    ).r.status,
    403,
  );
});
test("manual balances isolated, audit records reason and cannot go negative", async () => {
  await adjustment(
    db,
    admin,
    uid,
    "USDT",
    "100",
    "Local accounting test",
    id(),
  );
  const rows = (
    await db.query("SELECT * FROM accounts WHERE user_id=$1", [uid])
  ).rows;
  assert.equal(
    new D(rows.find((a) => a.bucket === "manual").balance).toString(),
    "100",
  );
  assert.ok(!rows.find((a) => a.bucket === "available"));
  await assert.rejects(
    adjustment(db, admin, uid, "USDT", "-101", "Local accounting test", id()),
    (e) => e.code === "INSUFFICIENT_BALANCE",
  );
  await assert.rejects(
    adjustment(db, admin, uid, "USDT", "10", "", id()),
    (e) => e.code === "REASON_REQUIRED",
  );
  await assert.rejects(db.query("DELETE FROM entries"));
  await assert.rejects(db.query("UPDATE journals SET reason='changed'"));
});
const event = () => ({
  verified: true,
  confirmations: 12,
  requiredConfirmations: 12,
  provider: "test-custody",
  transferId: "unique-output-1",
  txid: "test-tx",
  user: uid,
  asset: "USDT",
  network: "ETH-SEPOLIA",
  amount: "100",
});
test("confirmed deposits deduplicate on transfer ID; unverified deposit rejected", async () => {
  await assert.rejects(confirmedDeposit(db, { ...event(), verified: false }));
  await Promise.all([
    confirmedDeposit(db, event()),
    confirmedDeposit(db, event()),
  ]);
  assert.equal((await db.query("SELECT * FROM deposits")).rows.length, 1);
  assert.equal(
    new D(
      (
        await db.query(
          "SELECT balance FROM accounts WHERE user_id=$1 AND bucket='available'",
          [uid],
        )
      ).rows[0].balance,
    ).toString(),
    "100",
  );
});
test("concurrent withdrawals reserve funds atomically; retries do not reserve twice", async () => {
  const b = {
    asset: "USDT",
    network: "ETH-SEPOLIA",
    address: "0x" + "1".repeat(40),
    amount: "60",
  };
  const key = id();
  const results = await Promise.allSettled([
    withdrawal(db, uid, b, key),
    withdrawal(db, uid, b, id()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await withdrawal(db, uid, b, key);
  assert.equal((await db.query("SELECT * FROM withdrawals")).rows.length, 1);
  const available = (
    await db.query(
      "SELECT balance FROM accounts WHERE user_id=$1 AND bucket='available'",
      [uid],
    )
  ).rows[0];
  assert.equal(new D(available.balance).toString(), "39");
  await assert.rejects(
    withdrawal(db, uid, { ...b, amount: "11" }, key),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
});
const catalog = [
  {
    symbol: "BTCUSDT",
    asset: "BTC",
    supported: true,
    price: "100",
    filters: [],
  },
];
test("order reservation, partial fills, duplicate execution, cancel and rejection", async () => {
  await confirmedDeposit(db, {
    ...event(),
    transferId: "order-funding",
    amount: "1000",
  });
  const b = {
    symbol: "BTCUSDT",
    side: "BUY",
    type: "LIMIT",
    quantity: "2",
    price: "100",
  };
  const key = id(),
    o = await createOrder(db, uid, b, key, catalog);
  assert.equal((await createOrder(db, uid, b, key, catalog)).id, o.id);
  await assert.rejects(
    createOrder(db, uid, { ...b, quantity: "3" }, key, catalog),
  );
  const fill = id();
  assert.equal((await fillOrder(db, o.id, "1", "99", fill)).status, "partial");
  assert.equal((await fillOrder(db, o.id, "1", "99", fill)).duplicate, true);
  await assert.rejects(fillOrder(db, o.id, "2", "99", id()));
  await cancelOrder(db, uid, o.id);
  await assert.rejects(fillOrder(db, o.id, "1", "99", id()));
  const o2 = await createOrder(
    db,
    uid,
    { ...b, type: "MARKET", quantity: "1" },
    id(),
    catalog,
  );
  assert.equal((await fillOrder(db, o2.id, "1", "100", id())).status, "filled");
  await assert.rejects(
    createOrder(db, uid, { ...b, symbol: "FAKEUSDT" }, id(), catalog),
  );
  const unbalanced = await db.query(
    "SELECT j.id,a.asset,sum(e.amount) AS total FROM journals j JOIN entries e ON e.journal_id=j.id JOIN accounts a ON a.id=e.account_id GROUP BY j.id,a.asset HAVING sum(e.amount)<>0",
  );
  assert.equal(unbalanced.rows.length, 0);
});
test("password reset expires, is single-use and revokes all sessions", async () => {
  let raw = token();
  await db.query(
    "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()-interval '1 second')",
    [hash(raw), uid],
  );
  assert.equal(
    (
      await call("/api/auth/reset", {
        method: "POST",
        body: { token: raw, password: "Another-long-password" },
      })
    ).r.status,
    400,
  );
  raw = token();
  await db.query(
    "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '5 minutes')",
    [hash(raw), uid],
  );
  assert.equal(
    (
      await call("/api/auth/reset", {
        method: "POST",
        body: { token: raw, password: "Another-long-password" },
      })
    ).r.status,
    200,
  );
  assert.equal((await call("/api/me")).data.user, null);
  cookie = "";
  csrf = "";
  assert.equal(
    (
      await call("/api/auth/reset", {
        method: "POST",
        body: { token: raw, password: "Another-long-password" },
      })
    ).r.status,
    400,
  );
});
test("campaign inactive, custody unconfigured and no live money claims", async () => {
  assert.ok(
    (await call("/api/campaigns")).data.items.every(
      (c) => c.kind === "informational",
    ),
  );
  assert.equal(
    (await db.query("SELECT active FROM campaigns WHERE id='first-deposit'"))
      .rows[0].active,
    false,
  );
  const s = (await call("/api/status")).data;
  assert.equal(s.liveMoney, false);
  assert.equal(s.custody, false);
  assert.equal(s.mode, "directional-demo");
  assert.equal((await call("/api/auth/google")).r.status, 503);
  const cancelled = await call("/api/auth/google/callback?error=access_denied");
  assert.equal(cancelled.r.status, 302);
  assert.match(
    cancelled.r.headers.get("location"),
    /oauth_error=GOOGLE_CANCELLED/,
  );
});
test("database rejects account tampering and unbalanced journals", async () => {
  await assert.rejects(
    db.query("UPDATE accounts SET balance=balance+1 WHERE user_id=$1", [uid]),
  );
  await assert.rejects(
    db.query("UPDATE accounts SET asset='ETH' WHERE user_id=$1", [uid]),
  );
  await assert.rejects(db.query("TRUNCATE entries"));
  await assert.rejects(db.query("TRUNCATE journals CASCADE"));
  const a = (
      await db.query(
        "SELECT id,balance FROM accounts WHERE user_id=$1 AND asset='USDT' AND bucket='available'",
        [uid],
      )
    ).rows[0],
    jid = id(),
    after = new D(a.balance).plus(1).toFixed(18);
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO journals(id,reference,kind) VALUES($1,$2,'invalid_test')",
        [jid, "invalid:" + jid],
      );
      await tx.query("UPDATE accounts SET balance=$1 WHERE id=$2", [
        after,
        a.id,
      ]);
      await tx.query("INSERT INTO entries VALUES($1,$2,$3,$4,$5,$6)", [
        id(),
        jid,
        a.id,
        "1",
        a.balance,
        after,
      ]);
    }),
    /Unbalanced journal/,
  );
  assert.equal(
    (await db.query("SELECT * FROM journals WHERE id=$1", [jid])).rows.length,
    0,
  );
});
test("admin login requires TOTP; campaign ordering, expiry and bonus block", async () => {
  const secret = new OTPAuth.Secret({ size: 20 });
  const pw = await (
    await import("../server/core.js")
  ).passwordHash("Admin-test-password-123");
  await db.query(
    "UPDATE users SET password=$1,totp_enabled=TRUE,totp_secret=$2 WHERE id=$3",
    [pw, vault("a".repeat(64)).encrypt(secret.base32), admin],
  );
  assert.equal(
    (
      await call("/api/auth/login", {
        method: "POST",
        body: {
          email: "admin@test.invalid",
          password: "Admin-test-password-123",
        },
      })
    ).r.status,
    403,
  );
  const code = new OTPAuth.TOTP({ secret }).generate();
  const login = await call("/api/auth/login", {
    method: "POST",
    body: {
      email: "admin@test.invalid",
      password: "Admin-test-password-123",
      code,
    },
  });
  assert.equal(login.r.status, 200);
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  csrf = login.data.csrf;
  assert.equal((await call("/api/admin/users")).r.status, 200);
  const c = (await db.query("SELECT * FROM campaigns WHERE id='first-deposit'"))
    .rows[0];
  assert.equal(
    (
      await call("/api/admin/campaigns/first-deposit", {
        method: "PUT",
        body: { ...c, active: true },
      })
    ).r.status,
    409,
  );
  const info = (await db.query("SELECT * FROM campaigns WHERE id='assets'"))
    .rows[0];
  assert.equal(
    (
      await call("/api/admin/campaigns/assets", {
        method: "PUT",
        body: { ...info, active: true, ends_at: "2000-01-01T00:00:00Z" },
      })
    ).r.status,
    200,
  );
  assert.ok(
    !(await call("/api/campaigns")).data.items.some((c) => c.id === "assets"),
  );
});
test("manual adjustment retries have consistent payload and append-only audit", async () => {
  const key = id();
  const first = await adjustment(
    db,
    admin,
    uid,
    "USDT",
    "5",
    "Retry adjustment test",
    key,
  );
  assert.equal(
    await adjustment(db, admin, uid, "USDT", "5", "Retry adjustment test", key),
    first,
  );
  await assert.rejects(
    adjustment(db, admin, uid, "USDT", "6", "Retry adjustment test", key),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
});
test("18 decimal order math reconciles exact balances", async () => {
  const o = await createOrder(
    db,
    uid,
    {
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.100000000000000001",
      price: "99.123456789123456789",
    },
    id(),
    catalog,
  );
  await fillOrder(
    db,
    o.id,
    "0.100000000000000001",
    "99.123456789123456789",
    id(),
  );
  const mismatch = await db.query(
    "SELECT a.id FROM accounts a LEFT JOIN entries e ON e.account_id=a.id GROUP BY a.id,a.balance HAVING a.balance<>coalesce(sum(e.amount),0)",
  );
  assert.equal(mismatch.rows.length, 0);
});
test("server quotes use exact decimals and stable operation IDs", async () => {
  const body = {
    symbol: "BTCUSDT",
    side: "BUY",
    type: "LIMIT",
    quantity: "0.100000000000000001",
    price: "99.123456789123456789",
  };
  const calculated = calculateQuote(body, catalog);
  assert.equal(calculated.subtotal, "9.912345678912345778");
  assert.equal(calculated.fee, "0.009912345678912345");
  assert.equal(calculated.total, "9.922258024591258123");
  const operation = id(),
    q = await saveQuote(db, uid, body, catalog, operation);
  assert.equal((await saveQuote(db, uid, body, catalog, operation)).id, q.id);
  await assert.rejects(
    saveQuote(db, uid, { ...body, quantity: "1" }, catalog, operation),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  const accepted = await Promise.all([
    acceptQuote(db, uid, q.id, catalog),
    acceptQuote(db, uid, q.id, catalog),
  ]);
  assert.equal(accepted[0].id, accepted[1].id);
  await db.query(
    "UPDATE order_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
    [q.id],
  );
  assert.equal((await acceptQuote(db, uid, q.id, catalog)).id, accepted[0].id);
  const expired = await saveQuote(db, uid, body, catalog);
  await db.query(
    "UPDATE order_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.id],
  );
  await assert.rejects(
    acceptQuote(db, uid, expired.id, catalog),
    (e) => e.code === "QUOTE_EXPIRED",
  );
  const market = await saveQuote(db, uid, { ...body, type: "MARKET" }, catalog);
  await assert.rejects(
    acceptQuote(db, uid, market.id, [{ ...catalog[0], price: "101" }]),
    (e) => e.code === "QUOTE_CHANGED",
  );
  await assert.rejects(
    acceptQuote(db, admin, market.id, catalog),
    (e) => e.code === "QUOTE_NOT_FOUND",
  );
});
test("HTTP order API requires a server quote and ignores client fee/balance claims", async () => {
  await confirmedDeposit(db, {
    ...event(),
    user: admin,
    transferId: "admin-quote-funding",
    amount: "100",
  });
  const headers = { "Idempotency-Key": id() },
    body = {
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.1",
      price: "100",
      fee: "0",
      balance: "999999",
    };
  assert.equal(
    (await call("/api/orders", { method: "POST", body, headers })).data.error,
    "QUOTE_REQUIRED",
  );
  const q = await call("/api/orders/quote", { method: "POST", body, headers });
  assert.equal(q.r.status, 200);
  assert.equal(new D(q.data.fee).toString(), "0.01");
  const first = await call("/api/orders", {
    method: "POST",
    body: { quote_id: q.data.id, quantity: "9999", fee: "0" },
    headers,
  });
  assert.equal(first.r.status, 200);
  const retry = await call("/api/orders", {
    method: "POST",
    body: { quote_id: q.data.id },
    headers,
  });
  assert.equal(retry.data.id, first.data.id);
  const order = (
    await db.query("SELECT * FROM orders WHERE id=$1", [first.data.id])
  ).rows[0];
  assert.equal(new D(order.quantity).toString(), "0.1");
  assert.equal(new D(order.reserved).toString(), "10.01");
});
test("confirmed-deposit validation rejects missing finality and conflicting replays", async () => {
  await assert.rejects(
    confirmedDeposit(db, {
      ...event(),
      transferId: id(),
      requiredConfirmations: undefined,
    }),
    (e) => e.code === "UNVERIFIED_DEPOSIT",
  );
  await assert.rejects(
    confirmedDeposit(db, {
      ...event(),
      transferId: id(),
      confirmations: 1,
      requiredConfirmations: 1,
    }),
    (e) => e.code === "UNVERIFIED_DEPOSIT",
  );
  await assert.rejects(
    confirmedDeposit(db, { ...event(), amount: "101" }),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  await assert.rejects(db.query("UPDATE deposits SET amount=amount+1"));
  await assert.rejects(db.query("UPDATE fills SET fee=fee+1"));
  await assert.rejects(
    db.query("UPDATE orders SET quantity=quantity+1 WHERE status='filled'"),
  );
});
test("password reset racing with login cannot leave a session from old credentials", async () => {
  const raw = token();
  await db.query(
    "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '5 minutes')",
    [hash(raw), uid],
  );
  const [login, reset] = await Promise.all([
    call("/api/auth/login", {
      method: "POST",
      body: {
        email: "tester@example.invalid",
        password: "Another-long-password",
      },
    }),
    call("/api/auth/reset", {
      method: "POST",
      body: { token: raw, password: "Secure-third-password" },
    }),
  ]);
  assert.equal(reset.r.status, 200);
  assert.ok([200, 401].includes(login.r.status));
  assert.equal(
    (await db.query("SELECT * FROM sessions WHERE user_id=$1", [uid])).rows
      .length,
    0,
  );
});
