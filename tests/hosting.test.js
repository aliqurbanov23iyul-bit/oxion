import test from "node:test";
import assert from "node:assert/strict";
import { hostedConfig } from "../server/hosted-config.js";
import { hostedApplication } from "../app.js";
import { database } from "../server/db.js";
import { PostgresRateStore } from "../server/rate-store.js";
import { readFile } from "node:fs/promises";
import { id, hash } from "../server/core.js";
const env = {
  DATABASE_URL:
    "postgresql://test:unused@ep-test-pooler.neon.tech/test?sslmode=require",
  APP_ORIGIN: "https://oxion.example",
  ENCRYPTION_KEY: "b".repeat(64),
};
async function serve(app, fn) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await fn("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
test("hosted configuration refuses missing database, SSL, weak key, unsafe origin and worker activation", () => {
  assert.equal(hostedConfig(env).DATABASE_URL, env.DATABASE_URL);
  for (const change of [
    { DATABASE_URL: "" },
    { DATABASE_URL: "postgresql://u:p@host/db" },
    { ENCRYPTION_KEY: "short" },
    { APP_ORIGIN: "http://localhost:4317" },
    { APP_ORIGIN: "https://oxion.example/" },
    { ENABLE_BINANCE_TESTNET: "true" },
    { GOOGLE_CLIENT_ID: "id" },
    {
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "https://wrong.example/callback",
    },
  ])
    assert.throws(() => hostedConfig({ ...env, ...change }));
});
test("unconfigured Vercel runtime fails closed without connecting or revealing secrets", async () => {
  let calls = 0;
  await serve(
    hostedApplication({}, async () => {
      calls++;
    }),
    async (base) => {
      const response = await fetch(base + "/api/me");
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "SERVICE_NOT_CONFIGURED",
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
    },
  );
  assert.equal(calls, 0);
});
test("Vercel runtime shares initialization, skips migration and protects all admin HTML paths", async () => {
  const db = await database(null, "memory://");
  let calls = 0;
  const app = hostedApplication(env, async (url, path, options) => {
    calls++;
    assert.equal(options.migrate, false);
    return db;
  });
  try {
    await serve(app, async (base) => {
      const responses = await Promise.all([
        fetch(base + "/api/me"),
        fetch(base + "/api/status", {
          headers: {
            "x-real-ip": "203.0.113.10",
            "x-forwarded-for": "198.51.100.2",
          },
        }),
      ]);
      assert.ok(responses.every((r) => r.status === 200));
      assert.equal(calls, 1);
      for (const path of ["/admin", "/admin/", "/admin/index.html"])
        assert.equal((await fetch(base + path)).status, 401);
      const adminId = id(),
        sid = "hosting-test-session";
      await db.query(
        "INSERT INTO users(id,uid,email,role,verified,totp_enabled) VALUES($1,'OX-12345678','admin@hosting.invalid','admin',TRUE,TRUE)",
        [adminId],
      );
      await db.query(
        "INSERT INTO sessions(hash,user_id,csrf,expires_at) VALUES($1,$2,'csrf',now()+interval '1 hour')",
        [hash(sid), adminId],
      );
      const protectedPage = await fetch(base + "/admin/index.html", {
        headers: { Cookie: "sid=" + sid },
      });
      assert.equal(protectedPage.status, 200);
      assert.match(await protectedPage.text(), /data-page="admin"/);
      assert.equal(protectedPage.headers.get("cache-control"), "no-store");
      assert.equal(
        (await fetch(base + "/server/views/admin.html")).status,
        404,
      );
      assert.equal(
        (
          await fetch(base + "/api/auth/signup", {
            method: "POST",
            headers: {
              Origin: "https://evil.example",
              "Content-Type": "application/json",
            },
            body: "{}",
          })
        ).status,
        403,
      );
    });
  } finally {
    await db.close();
  }
});
test("rate limits are atomic and shared across instances, expire and separate scopes", async () => {
  const db = await database(null, "memory://");
  try {
    const first = new PostgresRateStore(db, "login"),
      second = new PostgresRateStore(db, "login"),
      other = new PostgresRateStore(db, "api");
    for (const store of [first, second, other])
      store.init({ windowMs: 900000 });
    const hits = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? first : second).increment("::1"),
      ),
    );
    assert.deepEqual(
      hits.map((x) => x.totalHits).sort((a, b) => a - b),
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    assert.equal((await other.increment("::1")).totalHits, 1);
    await db.query(
      "UPDATE request_limits SET reset_at=now()-interval '1 second' WHERE key=$1",
      [first.key("::1")],
    );
    assert.equal((await second.increment("::1")).totalHits, 1);
    assert.ok(
      (await db.query("SELECT key FROM request_limits")).rows.every(
        (x) => !x.key.includes("::1"),
      ),
    );
  } finally {
    await db.close();
  }
});
test("deployment excludes local secrets and has no public admin document", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.framework, "express");
  assert.ok(!config.buildCommand.includes("migrate"));
  await assert.rejects(readFile("public/admin/index.html"), { code: "ENOENT" });
  assert.ok((await readFile(".vercelignore", "utf8")).includes(".local"));
});
