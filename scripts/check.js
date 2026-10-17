import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
let count = 0;
assert.equal(spawnSync(process.execPath, ["--check", "app.js"]).status, 0);
count++;
for (const dir of ["server", "scripts", "tests", "public/assets"])
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".js")) continue;
    const r = spawnSync(process.execPath, ["--check", dir + "/" + file], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    count++;
  }
const pages = (await readdir("public")).filter((f) => f.endsWith(".html"));
await assert.rejects(
  readFile("public/admin/index.html"),
  { code: "ENOENT" },
  "Admin HTML must never be a CDN asset",
);
assert.match(
  await readFile("server/views/admin.html", "utf8"),
  /data-page="admin"/,
);
const hosting = JSON.parse(await readFile("vercel.json", "utf8"));
assert.equal(hosting.framework, "express");
assert.ok(hosting.functions["app.js"].includeFiles.includes("server/views/**"));
assert.equal(pages.length, 24);
for (const page of pages) {
  const html = await readFile("public/" + page, "utf8");
  assert.match(html, /type="module"/);
  assert.match(html, /id="main"/);
}
const env = await readFile(".env.example", "utf8");
assert.ok(
  env
    .trim()
    .split(/\r?\n/)
    .every((line) => /^\w+=$/.test(line)),
);
console.log(
  `Checked ${count} JavaScript files, ${pages.length + 1} HTML pages and blank environment template.`,
);
