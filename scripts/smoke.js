import { readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.env.APP_ORIGIN || "http://localhost:4317";
const pages = (await readdir("public")).filter((f) => f.endsWith(".html"));
for (let i = 0; i < pages.length; i += 4)
  await Promise.all(
    pages.slice(i, i + 4).map(async (page) => {
      const r = await fetch(origin + "/" + page);
      assert.equal(r.status, 200, page);
      const html = await r.text();
      assert.match(html, /data-page=/, page);
      assert.match(html, /OXION/, page);
    }),
  );
for (const path of [
  "/assets/app.js",
  "/assets/styles.css",
  "/assets/oxion-logo.png",
])
  assert.equal((await fetch(origin + path)).status, 200, path);
assert.equal(
  (await fetch(origin + "/admin/")).status,
  401,
  "Admin HTML must be protected",
);
assert.equal((await fetch(origin + "/not-an-oxion-page")).status, 404);
const mode = await (await fetch(origin + "/api/status")).json();
assert.equal(mode.liveMoney, false);
assert.equal(mode.mode, "local-simulation");
console.log(
  `${pages.length} public HTML pages, shared assets, protected admin, 404 and local-only status passed.`,
);
