import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { createApp } from "../server/app.js";
import { hash } from "../server/core.js";
import QRCode from "qrcode";
test("account API saves names, protects deposit admin routes, serves uploaded and generated QR", async () => {
  const db = await database(null, "memory://");
  let server;
  try {
    await db.query(
      "INSERT INTO users(id,uid,email,verified,role,totp_enabled) VALUES('a','OX-11112222','a@test.invalid',TRUE,'admin',TRUE),('u','OX-22223333','u@test.invalid',TRUE,'user',FALSE)",
    );
    for (const u of ["a", "u"])
      await db.query(
        "INSERT INTO sessions(hash,user_id,csrf,expires_at) VALUES($1,$2,'csrf',now()+interval '1 hour')",
        [hash(u.repeat(64)), u],
      );
    const origin = "http://localhost:4319";
    server = createApp(
      db,
      { APP_ORIGIN: origin, ENCRYPTION_KEY: "a".repeat(64) },
      { markets: async () => [] },
    ).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port;
    const call = (path, u = "u", body, method = body ? "POST" : "GET") =>
      fetch(base + "/api" + path, {
        method,
        headers: {
          Origin: origin,
          Cookie: "sid=" + u.repeat(64),
          "X-CSRF-Token": "csrf",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    assert.equal((await call("/admin/deposit-methods")).status, 403);
    assert.equal(
      (
        await fetch(base + "/admin/", {
          headers: { Cookie: "sid=" + "u".repeat(64) },
        })
      ).status,
      403,
    );
    const qr = await QRCode.toDataURL("0x" + "1".repeat(40));
    const payload = {
      asset: "USDT",
      network: "BEP20",
      address: "0x" + "1".repeat(40),
      confirmations: 15,
      active: true,
      qr_image: qr,
    };
    const created = await call("/admin/deposit-methods", "a", payload);
    assert.equal(created.status, 201);
    const m = await created.json();
    const image = await call("/deposit/methods/" + m.id + "/qr");
    assert.equal(image.headers.get("content-type").split(";")[0], "image/png");
    assert.deepEqual(
      Buffer.from(await image.arrayBuffer()),
      Buffer.from(qr.split(",")[1], "base64"),
    );
    assert.equal(
      (await (await call("/deposit/methods/" + m.id + "/minimum")).json())
        .minimum_amount,
      "10.000000000000000000",
    );
    assert.equal(
      (
        await call("/deposit/requests", "u", {
          method: m.id,
          amount: "9.99",
          txid: "a".repeat(64),
        })
      ).status,
      400,
    );
    const claimResponse = await call("/deposit/requests", "u", {
      method: m.id,
      amount: "12",
      request_key: "customer-claim-one",
    });
    assert.equal(claimResponse.status, 201);
    const claim = await claimResponse.json();
    assert.equal(claim.txid, null);
    const decision = {
      approve: true,
      verified: true,
      reason: "verified on chain and account ownership",
    };
    assert.equal(
      (
        await call(
          "/admin/deposit-requests/" + claim.id + "/review",
          "a",
          decision,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/admin/deposit-requests/" + claim.id + "/review", "a", {
          ...decision,
          txid: "0x" + "c".repeat(64),
        })
      ).status,
      200,
    );
    const history = await (await call("/deposit/requests")).json();
    assert.equal(history.items[0].status, "confirmed");
    assert.equal(history.items[0].txid, null);
    assert.equal((await call("/admin/withdrawal-requests")).status, 403);
    assert.equal((await call("/admin/withdrawal-requests", "a")).status, 200);
    const saved = await call(
      "/profile",
      "u",
      { language: "az", display_name: "Ali Qurbanov" },
      "PATCH",
    );
    assert.equal(saved.status, 200);
    assert.equal(
      (await (await call("/me")).json()).user.display_name,
      "Ali Qurbanov",
    );
    assert.equal(
      (
        await call(
          "/profile",
          "u",
          { language: "az", display_name: "<script>" },
          "PATCH",
        )
      ).status,
      400,
    );
    const auto = await (
      await call("/admin/deposit-methods", "a", { ...payload, qr_image: null })
    ).json();
    assert.match(
      (await call("/deposit/methods/" + auto.id + "/qr")).headers.get(
        "content-type",
      ),
      /image\/svg\+xml/,
    );
    await call(
      "/admin/deposit-methods/" + m.id,
      "a",
      { active: false },
      "PATCH",
    );
    assert.equal((await call("/deposit/methods/" + m.id + "/qr")).status, 404);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
  }
});
