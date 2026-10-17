import { mkdir, writeFile } from "node:fs/promises";
const pages = {
  index: ["home", "Ana səhifə"],
  markets: ["markets", "Bazarlar"],
  trade: ["trade", "Ticarət"],
  wallet: ["wallet", "Pul kisəsi"],
  deposit: ["deposit", "Depozit"],
  withdraw: ["withdraw", "Çıxarış"],
  history: ["history", "Tarixçə"],
  orders: ["orders", "Əmrlər"],
  login: ["login", "Daxil ol"],
  signup: ["signup", "Hesab yarat"],
  "verify-email": ["verify", "E-poçt təsdiqi"],
  "forgot-password": ["forgot", "Şifrə bərpası"],
  profile: ["profile", "Profil"],
  security: ["security", "Təhlükəsizlik"],
  promotions: ["promotions", "Kampaniyalar"],
  "promotion-details": ["promotionDetails", "Kampaniya şərtləri"],
  support: ["support", "Dəstək"],
  faq: ["faq", "Tez-tez verilən suallar"],
  about: ["about", "Haqqımızda"],
  fees: ["fees", "Komissiyalar və limitlər"],
  terms: ["terms", "İstifadə şərtləri"],
  privacy: ["privacy", "Məxfilik"],
  risk: ["risk", "Risk açıqlaması"],
  404: ["notfound", "Səhifə tapılmadı"],
  "admin/index": ["admin", "İdarəetmə"],
};
await mkdir("server/views", { recursive: true });
for (const [file, [key, title]] of Object.entries(pages))
  await writeFile(
    file === "admin/index" ? "server/views/admin.html" : `public/${file}.html`,
    `<!doctype html>
<html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="OXION — bazarlar, ticarət alətləri və hesab idarəetməsi."><meta name="theme-color" content="#080f20"><meta name="robots" content="noindex,nofollow"><title>OXION · ${title}</title><link rel="stylesheet" href="/assets/styles.css"><script type="module" src="/assets/app.js"></script></head>
<body data-page="${key}"><div id="site-header"></div><main id="main"><div class="wrap page-head"><h1>${title}</h1><p class="loading" role="status">OXION · Yüklənir…</p><noscript>Bu platforma JavaScript tələb edir. Real ticarət və köçürmələr aktiv deyil.</noscript></div></main><div id="site-footer"></div></body></html>\n`,
  );
console.log("Created " + Object.keys(pages).length + " separate HTML pages.");
