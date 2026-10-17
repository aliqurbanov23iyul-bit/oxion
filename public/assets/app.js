import { assetLogo } from "./asset-logos.js";
import { icon } from "./icons.js";
import { t, lang, setLanguage, languages, errorText } from "./i18n.js";
import {
  api,
  me,
  loadMe,
  escape as esc,
  toast,
  notice,
  empty,
  money,
  table,
  field,
  onForm,
  requestKey,
} from "./api.js";
const page = document.body.dataset.page;
const paths = {
  home: "index",
  promotionDetails: "promotion-details",
  verify: "verify-email",
  forgot: "forgot-password",
  notfound: "404",
};
const link = (key, cls = "") =>
  `<a class="${cls}${page === key ? " active" : ""}" href="/${paths[key] || key}.html" ${page === key ? 'aria-current="page"' : ""}>${t(key)}</a>`;
const names = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  TRX: "TRON",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  DOT: "Polkadot",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  SUI: "Sui",
  TON: "Toncoin",
  USDT: "Tether",
};
const symbols = {
  BTC: "₿",
  ETH: "♦",
  BNB: "◇",
  SOL: "≋",
  XRP: "×",
  DOGE: "Ð",
  ADA: "₳",
  TRX: "◈",
  AVAX: "▲",
  LINK: "⬡",
  DOT: "●",
  LTC: "Ł",
  BCH: "Ƀ",
  SUI: "◊",
  TON: "▽",
  USDT: "₮",
};
export const coin = (a) => assetLogo(a);
const brand = `<a class="brand" href="/index.html" aria-label="OXION"><img src="/assets/oxion-logo.png" alt="OXION" width="218" height="109"></a>`;
document.documentElement.lang = lang;
document.title = "OXION · " + t(page);
const main = document.querySelector("main");
let status;
try {
  await loadMe();
  status = await api("/status");
} catch (e) {
  status = { social: {}, email: false };
}
const instagram =
  '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" style="fill:currentColor;stroke:none"/></svg>';
const tiktok =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2h3c.2 3 1.7 4.6 4 5v3c-1.7 0-3-.5-4-1.3V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z"/></svg>';
const telegram =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 3.4 18.2 20c-.3 1.2-1 1.5-2 1l-5.2-3.9-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.3L17.6 6c.4-.4-.1-.6-.6-.3L5 13.3l-5.1-1.6c-1.1-.3-1.1-1.1.2-1.6L20 2.4c.9-.3 1.7.2 1.6 1z"/></svg>';

document.querySelector("#site-header").innerHTML =
  `<a href="#main" class="skip">${t("home")}</a><header class="header ${me.user ? "has-account" : ""}"><div class="wrap nav">${brand}<nav id="main-nav" class="navlinks" aria-label="${t("platform")}">${["home", "markets", "trade", "promotions", "support"].map((k) => link(k)).join("")}</nav><div class="navright"><select class="lang" data-language aria-label="${t("language")}">${languages.map((l) => '<option value="' + l + '" ' + (l === lang ? "selected" : "") + ">" + l.toUpperCase() + "</option>").join("")}</select>${me.user ? `<div class="nav-funds"><a href="/wallet.html" class="nav-balance" aria-label="${t("available")} · USDT"><span class="nav-balance-caption">${t("available")}</span><span class="nav-balance-number"><strong id="nav-balance-value" aria-live="polite">—</strong><small>USDT</small></span></a><a href="/deposit.html" class="btn nav-deposit">${icon("deposit")}<span>${t("depositAction")}</span></a></div><div class="nav-account-tools"><details class="account-menu nav-notifications"><summary class="iconbtn nav-tool" aria-label="${t("notifications")}">${icon("bell")}</summary><div class="account-dropdown"><strong>${t("notifications")}</strong><p>${t(me.user.verified ? "noNotifications" : "emailRequired")}</p>${!me.user.verified ? link("profile") : ""}</div></details><details class="account-menu nav-profile"><summary class="iconbtn nav-avatar" aria-label="${t("profile")}"><span>${esc(Array.from(me.user.display_name || me.user.email)[0].toUpperCase())}</span></summary><div class="account-dropdown"><a class="account-mini" href="/profile.html"><span class="account-mini-avatar">${esc(Array.from(me.user.display_name || me.user.email)[0].toUpperCase())}</span><span><strong>${esc(me.user.display_name || me.user.email.split("@")[0])}</strong><small>${esc(me.user.uid)}</small></span></a><button class="btn small outline" data-copy="${esc(me.user.uid)}">${icon("copy")} ${t("copy")}</button>${["profile", "wallet", "orders", "history", "security"].map((k) => link(k)).join("")}${me.user.role === "admin" ? '<a href="/admin/">' + t("admin") + "</a>" : ""}<button class="btn danger" id="nav-logout">${t("logout")}</button></div></details><button class="iconbtn mobile-toggle nav-tool" aria-label="${t("platform")}" aria-controls="main-nav" aria-expanded="false">${icon("menu")}</button></div>` : `${link("login", "login-link")}${link("signup", "btn small")}<button class="iconbtn mobile-toggle" aria-label="${t("platform")}" aria-controls="main-nav" aria-expanded="false">${icon("menu")}</button>`}</div></div></header>`;

async function refreshNavBalance() {
  if (!me.user || refreshNavBalance.pending) return;
  refreshNavBalance.pending = true;
  const el = document.querySelector("#nav-balance-value");
  try {
    const r = await api("/wallet");
    if (el) {
      el.textContent = money(
        r.items.find((a) => a.asset === "USDT" && a.bucket === "available")
          ?.balance || "0",
      );
      el.removeAttribute("title");
    }
  } catch {
    if (el) {
      el.textContent = "—";
      el.title = t("connection");
    }
  } finally {
    refreshNavBalance.pending = false;
  }
}
if (me.user) {
  refreshNavBalance();
  window.addEventListener("focus", refreshNavBalance);
  window.addEventListener("oxion:balance-changed", refreshNavBalance);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshNavBalance();
  });
  setInterval(() => {
    if (!document.hidden) refreshNavBalance();
  }, 60000);
}

document.querySelector("#nav-logout")?.addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
    location.assign("/login.html");
  } catch (e) {
    toast(e.message, true);
  }
});
document
  .querySelector(".navlinks")
  .insertAdjacentHTML(
    "beforeend",
    `<div class="mobile-account"><label class="mobile-language">${t("language")}<select data-language aria-label="${t("language")}">${languages.map((l) => `<option value="${l}" ${l === lang ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select></label>${(me.user ? ["wallet", "orders", "history", "profile", "security"] : ["login", "signup"]).map((k) => link(k)).join("")}</div>`,
  );
document.body.insertAdjacentHTML(
  "beforeend",
  `<a class="support-float" href="/support.html" aria-label="${t("support")}">${icon("support")}<span>${t("support")}</span></a>`,
);
document.addEventListener("click", (event) => {
  document.querySelectorAll(".account-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    document.querySelectorAll(".account-menu[open]").forEach((menu) => {
      menu.open = false;
      menu.querySelector("summary").focus();
    });
});
document
  .querySelectorAll("[data-language]")
  .forEach((select) => (select.onchange = (e) => setLanguage(e.target.value)));
document.querySelector(".mobile-toggle").onclick = (e) => {
  const open = document.querySelector(".navlinks").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", String(open));
  if (open)
    document.querySelector(".navlinks a")?.focus({ preventScroll: true });
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.querySelector(".navlinks.open")) {
    document.querySelector(".navlinks").classList.remove("open");
    const toggle = document.querySelector(".mobile-toggle");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }
});
const social = (name, icon) =>
  status.social?.[name] && /^https:\/\//.test(status.social[name])
    ? `<a href="${esc(status.social[name])}" target="_blank" rel="noopener noreferrer" aria-label="${name}">${icon}</a>`
    : `<span title="${t("socialMissing")}" aria-label="${name}: ${t("socialMissing")}">${icon}</span>`;
document.querySelector("#site-footer").innerHTML =
  `<footer class="footer"><div class="wrap"><div class="footergrid"><div>${brand}<p>${t("footerDesc")}</p><div class="socials">${social("instagram", instagram)}${social("tiktok", tiktok)}${social("telegram", telegram)}</div></div><div><h4>${t("platform")}</h4>${["markets", "trade", "wallet", "fees"].map((k) => link(k)).join("")}</div><div><h4>${t("company")}</h4>${["about", "support", "faq", "promotions"].map((k) => link(k)).join("")}</div><div><h4>${t("legal")}</h4>${["terms", "privacy", "risk"].map((k) => link(k)).join("")}</div></div><div class="copyright"><span>© ${new Date().getFullYear()} ${t("rights")}</span><a href="/risk.html">${t("riskFooter")}</a></div></div></footer>`;
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (b)
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      toast(t("copied"));
    } catch {
      toast(t("apiError"), true);
    }
});
document.addEventListener(
  "invalid",
  (event) => {
    const input = event.target;
    if (!input.validity) return;
    input.setCustomValidity(
      t(
        input.validity.valueMissing
          ? "fieldRequired"
          : input.validity.typeMismatch
            ? "invalidEmail"
            : input.name === "password" && input.validity.tooShort
              ? "passwordLength"
              : "invalidForm",
      ),
    );
  },
  true,
);
document.addEventListener("input", (event) => {
  if (event.target.setCustomValidity) event.target.setCustomValidity("");
});
function heading(key = page, sub = "") {
  return `<div class="page-head"><div class="eyebrow">OXION / SPOT</div><h1>${t(key)}</h1>${sub ? `<p>${t(sub)}</p>` : ""}</div>`;
}
function standard(content, key = page, sub = "") {
  main.innerHTML = `<div class="wrap">${heading(key, sub)}<div class="page-content">${content}</div></div>`;
}
function faq() {
  return `<div class="faq">${[1, 2, 3, 4].map((i) => `<details><summary>${t("faq" + i)}</summary><p>${t("faq" + i + "a")}</p></details>`).join("")}</div>`;
}
function promotions() {
  return `<div class="cards" id="campaign-cards"><article class="promo" id="bonus-preview-card"><span class="label preview">${t("preview")}</span><h3>${t("bonusTitle")}</h3><p>${t("bonusSub")}</p><a href="/promotion-details.html">${t("conditions")} ${icon("arrow")}</a><span class="promo-graphic" aria-hidden="true">200%</span></article></div>`;
}
async function activeCampaigns() {
  try {
    const [{ items }, { item: preview }] = await Promise.all([
      api("/campaigns"),
      api("/campaigns/preview"),
    ]);
    const container = document.querySelector("#campaign-cards");
    if (!container) return;
    if (preview) {
      const text = preview.texts[lang] || preview.texts.az;
      const card = document.querySelector("#bonus-preview-card");
      card.querySelector("h3").innerHTML = esc(text.title).replace(
        /(\d+%[^\s]*|%\d+[^\s]*)/g,
        '<span class="nowrap">$1</span>',
      );
      card.querySelector("p").textContent = text.subtitle || t("bonusSub");
      card.querySelector("a").href = preview.link;
      card.querySelector("a").textContent = text.cta || t("conditions");
      if (preview.image)
        card.insertAdjacentHTML(
          "beforeend",
          `<img class="campaign-image" src="${esc(preview.image)}" alt="">`,
        );
    }
    for (const c of items) {
      const text = c.texts[lang] || c.texts.az;
      container.insertAdjacentHTML(
        "beforeend",
        `<article class="promo"><span class="label">OXION SPOT</span><h3>${esc(text.title)}</h3><p>${esc(text.subtitle || "")}</p><a href="${esc(c.link)}">${esc(text.cta || t("explore"))} ${icon("arrow")}</a>${c.image ? `<img class="campaign-image" src="${esc(c.image)}" alt="">` : `<span class="promo-graphic" aria-hidden="true">${icon("trade")}</span>`}</article>`,
      );
    }
  } catch (e) {
    toast(e.message, true);
  }
}
function marketTable() {
  return `<div class="panel table-panel"><div class="tabs"><button data-filter="all" class="active">${t("all")}</button><button data-filter="popular">${t("popular")}</button><button data-filter="gainers">${t("gainers")}</button><label class="search"><span class="hidden">${t("search")}</span><input type="search" id="market-search" aria-label="${t("search")}" placeholder="${t("search")}"></label></div><div id="market-table"><div class="loading">${t("loading")}</div></div><div class="table-foot"><a href="/markets.html">${t("viewAll")} ${icon("arrow")}</a></div></div>`;
}
let catalog = [];
async function renderMarkets(home = false) {
  const target = document.querySelector("#market-table");
  let filter = "all";
  const render = () => {
    const term = (
      document.querySelector("#market-search")?.value || ""
    ).toUpperCase();
    let rows = catalog.filter((m) =>
      (m.symbol + names[m.asset]).toUpperCase().includes(term),
    );
    if (filter === "popular")
      rows = rows.filter((m) => ["BTC", "ETH", "BNB", "SOL"].includes(m.asset));
    if (filter === "gainers") rows = rows.filter((m) => Number(m.change) > 0);
    if (home) rows = rows.slice(0, 5);
    target.innerHTML = table(
      [
        t("asset"),
        t("price") + " (USDT)",
        t("change"),
        t("volume"),
        t("action"),
      ],
      rows.map(
        (m) =>
          `<tr><td><div class="coin-name">${coin(m.asset)}<div><strong>${esc(m.asset)}</strong><span class="coin-sub">${esc(names[m.asset])}</span></div></div></td><td><strong>${money(m.price, Number(m.price) < 1 ? 5 : 2)}</strong></td><td class="change ${Number(m.change) < 0 ? "negative" : ""}">${m.change === null ? "—" : `${Number(m.change) > 0 ? "+" : ""}${money(m.change)}%`}</td><td>${money(m.volume, 0)}</td><td>${m.supported ? `<a class="btn small outline" href="/trade.html?symbol=${esc(m.symbol)}">${t("trade")} ${icon("arrow")}</a>` : `<span class="badge">${t("unsupported")}</span>`}</td></tr>`,
      ),
    );
  };
  const load = async () => {
    try {
      catalog = (await api("/markets")).items;
      render();
      if (home)
        document.querySelector("#ticker-strip").innerHTML = catalog
          .slice(0, 4)
          .map(
            (m) =>
              `<div class="ticker"><span class="pair">${esc(m.asset)} / USDT</span><div class="price">${money(m.price)}</div><span class="change ${Number(m.change) < 0 ? "negative" : ""}">${m.change === null ? "—" : money(m.change) + "%"}</span> <small>24h</small></div>`,
          )
          .join("");
    } catch (e) {
      target.innerHTML = `<div class="empty">${esc(e.message)}<br><button class="btn small outline" id="retry-markets">${t("retry")}</button></div>`;
      document.querySelector("#retry-markets").onclick = load;
      if (home)
        document.querySelector("#ticker-strip").innerHTML = [
          "BTC",
          "ETH",
          "BNB",
          "SOL",
        ]
          .map(
            (asset) =>
              `<div class="ticker"><span class="pair">${asset} / USDT</span><div class="price">—</div><small>${t("unavailable")}</small></div>`,
          )
          .join("");
    }
  };
  document.querySelector("#market-search").oninput = render;
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        document
          .querySelectorAll("[data-filter]")
          .forEach((x) => x.classList.toggle("active", x === b));
        render();
      }),
  );
  await load();
  setInterval(() => {
    if (!document.hidden) load();
  }, 30000);
}
async function home() {
  main.innerHTML = `<section class="hero-zone"><div class="wrap"><div class="hero"><div><div class="eyebrow"><span class="pill">OXION SPOT</span>${t("yourPace")}</div><h1>${t("brandHeadline")}</h1><p>${t("brandDescription")}</p><div class="hero-actions">${link("signup", "btn")}<a class="btn outline" href="/markets.html">${t("explore")}</a></div><div class="hero-note"><span>${icon("shield")} ${t("spotOnly")}</span><span>${icon("check")} ${t("clearFees")}</span></div></div><div class="hero-art" role="img" aria-label="${t("visualOnly")}"><div class="orbital"></div><div class="orbital two"></div><div class="brand-sculpture" aria-hidden="true"><img src="/assets/oxion-logo.png" alt="" width="1774" height="887"></div><div class="floating top"><div class="tiny">OXION SPOT</div><strong>${t("yourPace").split(".")[0]}</strong><div class="mini-bars">${[12, 18, 14, 23, 19, 26, 22, 30, 25, 35, 31, 39].map((h) => `<i style="height:${h}px"></i>`).join("")}</div></div><div class="floating bottom"><div class="tiny">${t("fifteenSub")}</div><strong class="asset-wordmark">BTC <span>/</span> ETH <span>/</span> SOL</strong></div></div></div><div class="ticker-strip" id="ticker-strip">${["BTC", "ETH", "BNB", "SOL"].map((a) => `<div class="ticker"><span class="pair">${a} / USDT</span><div class="price">—</div><small>${t("loading")}</small></div>`).join("")}</div></div></section><div class="wrap"><section class="section"><div class="section-title"><div><h2>${t("featured")}</h2><p>${t("featuredSub")}</p></div>${link("promotions", "text-link")}</div>${promotions()}<div id="active-campaigns"></div></section><section class="section"><div class="section-title"><div><h2>${t("marketOverview")}</h2><p>${t("marketSub")}</p></div><a href="/markets.html" class="text-link">${t("viewAll")} ${icon("arrow")}</a></div>${marketTable()}</section><section class="section"><div class="section-title"><div><h2>${t("how")}</h2><p>${t("howSub")}</p></div></div><div class="steps">${[1, 2, 3].map((i) => `<div><div class="step-icon">${icon(["user", "shield", "trade"][i - 1])}</div><div class="step-num">0${i}</div><h3>${t("step" + i)}</h3><p>${t("step" + i + "Desc")}</p></div>`).join("")}</div></section><section class="section security-section"><div class="section-title"><div><h2>${t("securityTitle")}</h2><p>${t("securityIntro")}</p></div>${link("security", "text-link")}</div><div class="grid3">${["shield", "history", "user"].map((x, i) => `<article class="panel">${icon(x)}<h3>${t("securityFeature" + (i + 1))}</h3><p>${t("securityDetail" + (i + 1))}</p></article>`).join("")}</div></section><section class="section"><div class="section-title"><h2>${t("faq")}</h2>${link("faq", "text-link")}</div>${faq()}<div class="support-banner">${icon("support")}<div><h3>${t("needHelp")}</h3><p>${t("supportIntro")}</p></div>${link("support", "btn outline")}</div></section><section class="cta"><div><h2>${t("ctaTitle")}</h2><p>${t("ctaSub")}</p></div>${link("signup", "btn")}</section></div>`;
  renderMarkets(true);
  await activeCampaigns();
}
function needAuth() {
  if (me.user) return false;
  standard(
    `<div class="panel empty"><p>${t("authRequired")}</p>${link("login", "btn primary")}</div>`,
  );
  return true;
}
async function authPage() {
  if (
    page === "login" &&
    new URLSearchParams(location.search).get("google") === "totp"
  ) {
    standard(
      `<section class="panel form-card"><h2>${t("security")}</h2><form id="google-totp-form">${field("code", "code", "text", "inputmode=decimal pattern=[0-9]{6}")}<div data-result></div><button class="btn primary">${t("login")}</button></form></section>`,
    );
    onForm("#google-totp-form", async (b) => {
      await api("/auth/google/complete", { method: "POST", body: b });
      location.assign("/profile.html");
    });
    return;
  }
  const signup = page === "signup";
  main.innerHTML = `<div class="wrap"><section class="panel form-card"><div class="eyebrow">OXION · ${t("profile")}</div><h1>${t(page)}</h1><p>${t("authDesc")}</p>${status.google ? `<a href="/api/auth/google" class="btn google"><strong>G</strong> ${t("google")}</a>` : `<button type="button" class="btn google" disabled><strong>G</strong> ${t("google")}</button>`}${!status.google ? notice(t("googleMissing")) : ""}<div class="or">${t("or")}</div><form id="auth-form">${field("email", "email", "email", 'autocomplete="email" inputmode="email" placeholder="name@example.com" maxlength="254"')}${field("password", "password", "password", `autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" maxlength="128"`)}${signup ? `<span class="hint">${t("passwordHint")}</span>${field("passwordConfirm", "repeatPassword", "password", 'autocomplete="new-password" minlength="8" maxlength="128" aria-describedby="password-match"')}<span id="password-match" class="field-error" aria-live="polite"></span><label class="consent"><input type="checkbox" name="terms" required><span>${t("termsConsent")} ${link("terms", "text-link")}</span></label>` : field("code", "code", "text", 'inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"').replace(" required", "")}<div data-result aria-live="polite"></div><button class="btn primary" type="submit">${t(page)} ${icon("arrow")}</button></form><div class="auth-extra"><span>${t(signup ? "haveAccount" : "noAccount")} ${link(signup ? "login" : "signup")}</span>${!signup ? link("forgot") : ""}</div><p class="hint">${link("terms")} · ${link("privacy")} · ${link("risk")}</p></section></div>`;
  document
    .querySelectorAll('#auth-form input[type="password"]')
    .forEach((input) => {
      input.setAttribute(
        "aria-label",
        t(input.name === "passwordConfirm" ? "repeatPassword" : "password"),
      );
      const wrap = document.createElement("div");
      wrap.className = "password-control";
      input.after(wrap);
      wrap.append(input);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "iconbtn";
      button.setAttribute("aria-label", t("showPassword"));
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = icon("eye");
      wrap.append(button);
      button.onclick = () => {
        const shown = input.type === "password";
        input.type = shown ? "text" : "password";
        button.setAttribute(
          "aria-label",
          t(shown ? "hidePassword" : "showPassword"),
        );
        button.setAttribute("aria-pressed", String(shown));
      };
    });
  document
    .querySelector('[name="passwordConfirm"]')
    ?.addEventListener("input", (e) => {
      document.querySelector("#password-match").textContent =
        e.target.value &&
        e.target.value !== document.querySelector('[name="password"]').value
          ? t("passwordMismatch")
          : "";
      e.target.removeAttribute("aria-invalid");
    });
  const oauthError = new URLSearchParams(location.search).get("oauth_error");
  if (oauthError)
    document.querySelector("#auth-form [data-result]").innerHTML = notice(
      errorText(oauthError),
      "error",
    );
  onForm("#auth-form", async (b, f) => {
    if (signup && b.password !== b.passwordConfirm) {
      document.querySelector("#password-match").textContent =
        t("passwordMismatch");
      f.elements.passwordConfirm.setAttribute("aria-invalid", "true");
      f.elements.passwordConfirm.focus();
      return;
    }
    const r = await api("/auth/" + page, { method: "POST", body: b });
    if (signup)
      f.querySelector("[data-result]").innerHTML = notice(
        t(r.delivery === "smtp" ? "checkEmail" : "smtpMissing"),
        r.delivery === "smtp" ? "success" : "warn",
      );
    else location.assign("/wallet.html");
  });
}
async function tokenPage() {
  const raw = new URLSearchParams(location.search).get("token");
  const verify = page === "verify";
  standard(
    `<div class="panel form-card"><h2>${t(page)}</h2><p class="hint">${t("tokenHint")}</p>${!status.email ? notice(t("smtpMissing"), "warn") : ""}<form id="token-form">${verify ? "" : raw ? field("password", "newPassword", "password", 'minlength="8" maxlength="128" autocomplete="new-password"') : field("email", "email", "email", 'autocomplete="email"')}<div data-result aria-live="polite"></div><button class="btn primary" ${verify && !raw ? "disabled" : ""}>${t(verify ? "verifyButton" : raw ? "save" : "send")}</button></form><p class="hint">${link("login")}</p></div>`,
  );
  onForm("#token-form", async (b, f) => {
    const r = await api(
      "/auth/" + (verify ? "verify" : raw ? "reset" : "forgot"),
      { method: "POST", body: { ...b, token: raw } },
    );
    f.querySelector("[data-result]").innerHTML = notice(
      t(
        verify
          ? "verified"
          : raw
            ? "saved"
            : r.delivery === "smtp"
              ? "forgotSent"
              : "smtpMissing",
      ),
      "success",
    );
  });
}
async function profile() {
  if (needAuth()) return;
  await (await import("./profile.js")).renderProfile(standard);
}
async function security() {
  if (needAuth()) return;
  standard(
    `<div class="stack"><div class="panel"><h2>${t("security")}</h2>${notice(t("faq4a"))}<span class="badge ${me.user.totp ? "ok" : ""}">TOTP · ${t(me.user.totp ? "enabled" : "unverified")}</span>${!me.user.totp ? `<p><button class="btn primary" id="setup-totp">${t("enable2fa")}</button></p><div id="totp-setup"></div>` : ""}</div><div class="panel"><h3>${t("sessions")}</h3><div id="sessions"></div></div><div class="panel"><h3>${t("loginHistory")}</h3><div id="login-history"></div></div></div>`,
  );
  const r = await api("/security");
  document.querySelector("#sessions").innerHTML = table(
    [t("date"), "IP", t("user"), t("action")],
    r.sessions.map(
      (s) =>
        `<tr><td>${date(s.created_at)}</td><td>${esc(s.ip)}</td><td>${esc(s.agent.slice(0, 65))}</td><td>${s.current ? `<span class="badge ok">${t("current")}</span>` : `<button class="btn small outline" data-revoke="${esc(s.hash)}">${t("revoke")}</button>`}</td></tr>`,
    ),
  );
  document.querySelector("#login-history").innerHTML = table(
    [t("date"), "IP", t("user")],
    r.history.map(
      (s) =>
        `<tr><td>${date(s.created_at)}</td><td>${esc(s.ip)}</td><td>${esc(s.agent.slice(0, 70))}</td></tr>`,
    ),
  );
  document.querySelectorAll("[data-revoke]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api("/security/sessions/" + b.dataset.revoke, {
          method: "DELETE",
        });
        security();
      }),
  );
  document.querySelector("#setup-totp")?.addEventListener("click", async () => {
    try {
      const r = await api("/security/totp/setup", { method: "POST" });
      document.querySelector("#totp-setup").innerHTML =
        `<p class="hint">${t("totpHint")}</p><img class="qr" src="${r.qr}" alt="TOTP QR"><p><code>${esc(r.secret)}</code></p><form id="totp-form">${field("code", "code", "text", 'inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"')}<div data-result></div><button class="btn primary">${t("confirm")}</button></form>`;
      onForm("#totp-form", async (b) => {
        await api("/security/totp/enable", { method: "POST", body: b });
        location.reload();
      });
    } catch (e) {
      toast(e.message, true);
    }
  });
}
function date(v) {
  return esc(
    new Date(v).toLocaleString(
      { az: "az-AZ", en: "en-GB", tr: "tr-TR", ru: "ru-RU" }[lang],
    ),
  );
}
const bucketKey = {
  available: "available",
  locked: "locked",
  manual: "manual",
  bonus: "bonus",
};
async function wallet() {
  if (needAuth()) return;
  const r = await api("/wallet");
  const balance =
    r.items.find((a) => a.asset === "USDT" && a.bucket === "available")
      ?.balance || "0";
  standard(
    `<section class="wallet-sheet"><div class="profile-sheet-heading"><span>${t("wallet")}</span><a class="profile-close" href="/profile.html" aria-label="${t("profile")}">×</a></div><div class="wallet-single-balance"><div class="wallet-emblem">${icon("wallet")}</div><span class="wallet-balance-label">${t("available")}</span><div class="wallet-single-amount"><strong>${money(balance)}</strong><span>USDT</span></div></div><div class="wallet-single-actions"><a class="btn" href="/deposit.html">${icon("deposit")}${t("deposit")}</a><a class="btn soft" href="/withdraw.html">${icon("withdraw")}${t("withdraw")}</a></div></section>`,
  );
}
async function deposit() {
  if (needAuth()) return;
  await (await import("./deposits.js")).renderDeposits(standard);
}
async function withdraw() {
  if (needAuth()) return;
  standard(
    `<div class="transfer-layout"><section class="transfer-sheet"><div class="profile-sheet-heading"><span>${t("withdraw")}</span><a class="profile-close" href="/profile.html" aria-label="${t("profile")}">×</a></div><div class="crypto-rail"><span>${coin("USDT")}${t("cryptoOnly")}</span></div><form id="withdraw-form"><div class="transfer-select">${coin("USDT")}<label class="hidden" for="withdraw-asset">${t("asset")}</label><select id="withdraw-asset" name="asset" aria-label="${t("asset")}"><option>USDT</option></select></div><div class="transfer-select"><label class="hidden" for="withdraw-network">${t("network")}</label><select name="network" id="withdraw-network" aria-label="${t("network")}"><option value="ETH-SEPOLIA">Ethereum Sepolia · TESTNET</option></select></div><div class="transfer-minimum"><strong>${t("minimum")} 10 USDT</strong><p>${t("withdrawUnavailable")}</p></div>${field("address", "address", "text", 'pattern="0x[a-fA-F0-9]{40}" autocomplete="off"')}${field("amount", "amount", "text", 'inputmode="decimal" pattern="[0-9]+([.][0-9]{1,18})?"')}${field("code", "code", "text", 'inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"')}<div class="transfer-estimates"><div><span>${t("fee")}</span><strong>1 USDT</strong></div><div><span>${t("receive")}</span><strong id="withdraw-net">—</strong></div><div><span>${t("total")}</span><strong id="withdraw-total">—</strong></div></div><div data-result></div><button class="btn primary transfer-submit">${t("request")}</button></form><div class="transfer-links"><a href="/wallet.html">${t("wallet")}</a><a href="/support.html">${t("support")}</a></div></section><aside class="transfer-aside"><section class="panel"><h3>${t("security")}</h3>${notice(t("withdrawUnavailable"), "warn")}<p class="hint">${t("balanceNote")}</p><p class="hint">${t("faq4a")}</p>${link("security", "btn soft")}</section><section class="panel"><h3>${t("history")}</h3><div id="withdraw-history"></div></section></aside></div>`,
  );
  const f = document.querySelector("#withdraw-form");
  f.amount.oninput = () => {
    document.querySelector("#withdraw-net").textContent = f.amount.value
      ? money(f.amount.value, 8) + " USDT"
      : "—";
    document.querySelector("#withdraw-total").textContent = f.amount.value
      ? money(Number(f.amount.value) + 1, 8) + " USDT"
      : "—";
  };
  let key = requestKey();
  onForm("#withdraw-form", async (b) => {
    const quote = await api("/withdrawals/quote", { method: "POST", body: b });
    const ok = await confirmDialog(
      `${t("amount")}: ${esc(quote.amount)} USDT<br>${t("fee")}: ${esc(quote.fee)} USDT<br>${t("total")}: ${esc(quote.total)} USDT<br>${t("receive")}: ${esc(quote.receive)} USDT<br>${esc(quote.network)}<br><code>${esc(quote.address)}</code><p>${t("noReal")}</p>`,
    );
    if (!ok) return;
    await api("/withdrawals", {
      method: "POST",
      body: b,
      headers: { "Idempotency-Key": key },
    });
    key = requestKey();
    toast(t("withdrawCreated"));
    withdraw();
  });
  const r = await api("/withdrawals");
  document.querySelector("#withdraw-history").innerHTML = table(
    [t("date"), t("amount"), t("fee"), t("status"), t("txid")],
    r.items.map(
      (w) =>
        `<tr><td>${date(w.created_at)}</td><td>${money(w.amount, 8)}</td><td>${money(w.fee)}</td><td>${statusLabel(w.status)}</td><td>${w.txid ? `<a href="https://sepolia.etherscan.io/tx/${encodeURIComponent(w.txid)}" rel="noopener" target="_blank">${esc(w.txid)}</a>` : "—"}</td></tr>`,
    ),
  );
}
export function statusLabel(s) {
  const map = {
    open: "openOrders",
    partial: "partial",
    filled: "completed",
    cancelled: "cancelled",
    rejected: "rejected",
    expired: "expired",
    testnet_fill: "testnet",
    confirmed: "verified",
    awaiting_review: "unverified",
    failed: "apiError",
    answered: "reply",
    manual_adjustment: "adjustment",
    crypto_deposit: "deposit",
    admin_confirmed_deposit: "deposit",
    simulation_fill: "simulate",
    order_reserve: "locked",
    withdrawal_reserve: "locked",
    order_cancel: "cancel",
    order_release: "available",
    withdrawal_rejected: "reject",
    test_funding: "testFunds",
  };
  return t(map[s] || "status");
}
export async function confirmDialog(content) {
  const d = document.createElement("dialog");
  d.className = "confirm-dialog";
  d.innerHTML = `<h2>${t("review")}</h2><div class="hint">${content}</div><div class="form-inline" style="margin-top:25px"><button class="btn primary" data-ok>${t("confirm")}</button><button class="btn outline" data-cancel>${t("cancel")}</button></div>`;
  document.body.append(d);
  d.showModal();
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      d.close();
      d.remove();
      resolve(v);
    };
    d.querySelector("[data-ok]").onclick = () => done(true);
    d.querySelector("[data-cancel]").onclick = () => done(false);
    d.oncancel = (e) => {
      e.preventDefault();
      done(false);
    };
  });
}
async function history() {
  if (needAuth()) return;
  await (await import("./activity.js")).renderHistory(standard, statusLabel);
}
async function orders(target = null) {
  if (!target && needAuth()) return;
  if (!me.user) {
    if (target) target.innerHTML = notice(t("authRequired"));
    return;
  }
  if (!target) {
    await (await import("./activity.js")).renderOrders(standard, statusLabel);
    return;
  }
  const r = await api("/orders");
  const html = table(
    [
      t("date"),
      t("asset"),
      t("action"),
      t("quantity"),
      t("price"),
      t("status"),
      t("action"),
    ],
    r.items.map(
      (o) =>
        `<tr><td>${date(o.created_at)}</td><td>${esc(o.symbol)}<br><span class="badge">${t(o.execution_mode === "binance-testnet" ? "testnet" : "testMode")}</span></td><td>${t(o.side === "BUY" ? "buy" : "sell")} / ${t(o.type === "LIMIT" ? "limit" : "market")}</td><td>${money(o.filled, 8)} / ${money(o.quantity, 8)}</td><td>${money(o.price, 8)}</td><td>${statusLabel(o.status)}</td><td>${["open", "partial"].includes(o.status) ? `<button class="btn small outline" data-cancel-order="${esc(o.id)}">${t("cancel")}</button>` : "—"}</td></tr>`,
    ),
  );
  if (target) target.innerHTML = html;
  else
    standard(
      `${notice(t("simulationOrder"))}<div class="panel table-panel">${html}</div>`,
    );
  document.querySelectorAll("[data-cancel-order]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const result = await api("/orders/" + b.dataset.cancelOrder, {
            method: "DELETE",
          });
          if (result.status === "cancel_requested") toast(t("cancelRequested"));
          orders(target);
        } catch (e) {
          toast(e.message, true);
        }
      }),
  );
}
async function support() {
  const categories = [
    ["account", "accountCategory", "user"],
    ["google", "googleCategory", "user"],
    ["deposit", "deposit", "deposit"],
    ["withdraw", "withdraw", "withdraw"],
    ["trade", "trade", "trade"],
    ["security", "security", "shield"],
  ];
  standard(
    `<p class="support-intro">${t("supportIntro")}</p><div class="support-topics">${categories.map(([v, k, ic]) => `<a class="panel topic-card" href="#support-request" data-category="${v}">${icon(ic)}<strong>${t(k)}</strong>${icon("arrow")}</a>`).join("")}</div><section class="section"><h2>${t("faq")}</h2>${faq()}</section><section id="support-request"><article id="topic-answer" class="panel" hidden aria-live="polite"></article>${notice(t("supportNotice"))}${me.user ? `<div class="grid2"><div class="panel"><h2>${t("support")}</h2><form id="ticket-form"><label>${t("category")}<select name="category">${categories.map(([v, k]) => `<option value="${v}">${t(k)}</option>`).join("")}</select></label>${field("subject", "subject", "text", 'minlength="4" maxlength="150"')}<label>${t("message")}<textarea name="message" required minlength="10" maxlength="5000"></textarea></label><div data-result aria-live="polite"></div><button class="btn primary">${t("send")}</button></form></div><section class="panel"><h3>${t("tickets")}</h3><div id="tickets" aria-live="polite"></div></section></div>` : `<div class="panel support-banner"><div><h3>${t("tickets")}</h3><p>${t("supportPrivate")}</p></div>${link("login", "btn primary")}</div>`}</section>`,
  );
  document.querySelectorAll("[data-category]").forEach(
    (a) =>
      (a.onclick = () => {
        const select = document.querySelector('[name="category"]');
        if (select) select.value = a.dataset.category;
        const topic = categories.find((c) => c[0] === a.dataset.category);
        const answer = document.querySelector("#topic-answer");
        answer.hidden = false;
        const key = {
          account: "step1Desc",
          google: status.google ? "googleHelp" : "googleMissing",
          deposit: "depositManualInfo",
          withdraw: "custodyMissing",
          trade: "simulationOrder",
          security: "faq4a",
        }[a.dataset.category];
        answer.innerHTML = `<h3>${t(topic[1])}</h3><p>${t(key)}</p>`;
      }),
  );
  if (!me.user) return;
  const renderTickets = async () => {
    const r = await api("/tickets");
    document.querySelector("#tickets").innerHTML = r.items.length
      ? r.items
          .map(
            (x) =>
              `<article class="ticket"><span class="hint">#${esc(x.id)}</span><h4>${esc(x.subject)}</h4><span class="badge">${t(categories.find((c) => c[0] === x.category)?.[1] || "accountCategory")}</span><span class="badge">${statusLabel(x.status)}</span><p>${esc(x.message)}</p>${x.reply ? `<p class="notice">${esc(x.reply)}</p>` : ""}<div class="divider"></div></article>`,
          )
          .join("")
      : empty();
  };
  onForm("#ticket-form", async (b, f) => {
    const r = await api("/tickets", { method: "POST", body: b });
    f.reset();
    f.querySelector("[data-result]").innerHTML = notice(
      t("ticketCreated") + " · #" + r.id + " · " + statusLabel(r.status),
      "success",
    );
    await renderTickets();
  });
  await renderTickets();
}

async function trade() {
  standard(
    `<div class="trade-summary"><label class="hidden" for="pair">${t("asset")}</label><select id="pair" disabled aria-label="${t("asset")}"><option>BTCUSDT</option></select><label class="pair-search"><span class="hidden">${t("search")}</span><input type="search" disabled id="pair-search" aria-label="${t("search")}" list="pair-options" placeholder="${t("search")}"><button id="pair-apply" type="button" class="iconbtn" aria-label="${t("search")}" disabled>${icon("search")}</button><datalist id="pair-options"></datalist></label><div><span class="hint">${t("price")} (USDT)</span><div class="metric" id="trade-price">—</div></div><div><span class="hint">${t("change")}</span><p class="change" id="trade-change">—</p></div><div><span class="hint">${t("volume")}</span><p id="trade-volume">—</p></div></div>${notice(t("simulationOrder"))}<div class="trade-grid"><section class="panel chart-panel"><div class="chart-toolbar"><strong id="chart-symbol">BTC / USDT</strong>${["1m", "5m", "15m", "1h", "4h", "1d"].map((i) => `<button disabled data-interval="${i}" class="${i === "1h" ? "active" : ""}">${i}</button>`).join("")}</div><div id="chart-state" class="hint" role="status"></div><button id="retry-trade" class="btn small outline" hidden>${t("retry")}</button><svg class="chart" id="candles" role="img" aria-label="${t("chart")}" viewBox="0 0 700 300"></svg><p class="hint">Binance · ${t("marketSub")}</p></section><section class="panel book"><h3>${t("book")}</h3><div class="book-row muted"><span>${t("price")} (USDT)</span><span>${t("quantity")}</span></div><div id="book-asks">${empty()}</div><div class="divider"></div><div id="book-bids"></div></section><section class="panel order-form"><div class="segmented"><button data-side="BUY" class="active">${t("buy")}</button><button data-side="SELL">${t("sell")}</button></div><form id="order-form"><label>${t("action")}<select name="type"><option value="MARKET">${t("market")}</option><option value="LIMIT">${t("limit")}</option></select></label><label id="limit-price" hidden>${t("price")} (USDT)<input name="price" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,18})?"></label><label><span class="trade-quantity-label">${t("tradeBaseQuantity")}<span id="quantity-asset">BTC</span></span><input name="quantity" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,18})?" required autocomplete="off"></label><div class="trade-percentages">${[25, 50, 75, 100].map((p) => `<button type="button" data-percent="${p}" ${!me.user ? "disabled" : ""}>${p}%</button>`).join("")}</div><label>${t("tradeBudget")}<span class="trade-budget-input"><input name="budget" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-describedby="budget-hint"><button type="button" id="calculate-size" ${!me.user ? "disabled" : ""}>${t("tradeCalculate")}</button></span></label><p class="trade-input-hint" id="budget-hint">${t("tradeBudgetHint")}</p><p class="trade-input-hint" id="sizing-state" role="status"></p><div class="trade-available" id="trade-balance">${me.user ? t("loading") : t("authRequired")}</div><div class="trade-input-hint" id="pair-rules"></div><div class="trade-costs"><div><span>${t("fee")} (0.10%) ≈</span><strong id="order-fee">—</strong></div><div><span>${t("total")} ≈</span><strong id="order-estimate">—</strong></div></div><div data-result></div><button id="trade-submit" class="btn primary trade-buy" ${!me.user ? "disabled" : ""}>${t("tradeReviewBuy")}</button>${!me.user ? link("login", "text-link") : ""}</form></section></div><section class="section grid2"><div class="panel table-panel"><div class="tabs"><a href="/orders.html">${t("orders")} ${icon("arrow")}</a></div><div id="trade-orders"></div></div><section class="panel"><h3>${t("recentTrades")}</h3><div id="market-trades"></div></section></section>`,
  );
  let selected =
      new URLSearchParams(location.search).get("symbol") ||
      localStorage.getItem("oxion-pair") ||
      "BTCUSDT",
    interval = "1h",
    side = "BUY",
    currentPrice = null,
    generation = 0,
    key =
      (me.user && sessionStorage.getItem("oxion-order-key-" + me.user.uid)) ||
      requestKey();
  const f = document.querySelector("#order-form");
  let sizingRevision = 0;
  function resetOrderKey() {
    key = requestKey();
    if (me.user) sessionStorage.removeItem("oxion-order-key-" + me.user.uid);
  }
  function pairChanged() {
    resetOrderKey();
    localStorage.setItem("oxion-pair", selected);
    f.quantity.value = "";
    f.budget.value = "";
    f.price.value = "";
    sizingRevision++;
    document.querySelector("#sizing-state").textContent = "";
  }
  function updateSide() {
    const submit = document.querySelector("#trade-submit");
    submit.textContent = t(
      side === "BUY" ? "tradeReviewBuy" : "tradeReviewSell",
    );
    submit.classList.toggle("trade-sell", side === "SELL");
    submit.classList.toggle("trade-buy", side === "BUY");
    document
      .querySelector(".order-form")
      .classList.toggle("selling", side === "SELL");
    document.querySelectorAll("[data-side]").forEach((btn) => {
      const active = btn.dataset.side === side;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }
  f.type.onchange = () => {
    resetOrderKey();
    f.budget.value = "";
    document.querySelector("#limit-price").hidden = f.type.value !== "LIMIT";
    f.price.required = f.type.value === "LIMIT";
    sizingRevision++;
    estimate();
  };
  function estimate() {
    const p = Number(f.type.value === "LIMIT" ? f.price.value : currentPrice),
      q = Number(f.quantity.value),
      valid = Number.isFinite(p) && p > 0 && Number.isFinite(q) && q > 0;
    document.querySelector("#order-estimate").textContent = valid
      ? money(p * q * (side === "BUY" ? 1.001 : 0.999), 8) + " USDT"
      : "—";
    document.querySelector("#order-fee").textContent = valid
      ? money(p * q * 0.001, 8) + " USDT"
      : "—";
  }
  f.quantity.oninput = () => {
    resetOrderKey();
    sizingRevision++;
    f.budget.value = "";
    document.querySelector("#sizing-state").textContent = "";
    estimate();
  };
  f.price.oninput = () => {
    resetOrderKey();
    f.budget.value = "";
    sizingRevision++;
    estimate();
  };
  f.budget.oninput = () => {
    resetOrderKey();
    sizingRevision++;
    f.quantity.value = "";
    document.querySelector("#sizing-state").textContent = "";
    estimate();
  };
  async function size(percent) {
    resetOrderKey();
    if (!me.user) {
      toast(t("authRequired"), true);
      return;
    }
    const revision = ++sizingRevision,
      out = document.querySelector("#sizing-state");
    out.textContent = t("loading");
    try {
      const result = await api("/orders/size", {
        method: "POST",
        body: {
          symbol: selected,
          side,
          type: f.type.value,
          price: f.price.value,
          ...(percent !== undefined ? { percent } : { budget: f.budget.value }),
        },
      });
      if (revision !== sizingRevision) return;
      f.quantity.value = result.quantity.replace(
        /(\.\d*?[1-9])0+$|\.0+$/,
        "$1",
      );
      f.budget.value = result.total.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
      out.textContent = "";
      estimate();
    } catch (e) {
      if (revision === sizingRevision) out.textContent = e.message;
    }
  }
  document.querySelector("#calculate-size").onclick = () => size();
  f.budget.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      size();
    }
  };
  document
    .querySelectorAll("[data-percent]")
    .forEach((btn) => (btn.onclick = () => size(Number(btn.dataset.percent))));
  document.querySelectorAll("[data-side]").forEach(
    (btn) =>
      (btn.onclick = () => {
        side = btn.dataset.side;
        f.budget.value = "";
        resetOrderKey();
        sizingRevision++;
        document.querySelector("#sizing-state").textContent = "";
        updateSide();
        estimate();
        balance();
      }),
  );
  document.querySelector(".book").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-price]");
    if (!btn) return;
    f.type.value = "LIMIT";
    f.price.value = btn.dataset.bookPrice;
    f.type.onchange();
    f.price.focus();
  });
  async function balance() {
    if (!me.user) return;
    const a = side === "BUY" ? "USDT" : selected.replace(/USDT$/, "");
    try {
      const r = await api("/wallet");
      if (a !== (side === "BUY" ? "USDT" : selected.replace(/USDT$/, "")))
        return;
      const available =
          r.items.find((b) => b.asset === a && b.bucket === "available")
            ?.balance || "0",
        locked =
          r.items.find((b) => b.asset === a && b.bucket === "locked")
            ?.balance || "0";
      document.querySelector("#trade-balance").innerHTML =
        `<span>${t("available")}<strong>${money(available, 8)} ${esc(a)}</strong></span><span>${t("locked")}<strong>${money(locked, 8)} ${esc(a)}</strong></span><a href="/deposit.html">${t("depositAction")} ${icon("arrow")}</a>`;
    } catch (e) {
      document.querySelector("#trade-balance").textContent = e.message;
    }
  }
  updateSide();
  balance();
  let lastUpdate = null;
  async function load() {
    const thisGeneration = ++generation;
    try {
      const detail = await api(
        "/markets/" + selected + "?interval=" + interval,
      );
      if (thisGeneration !== generation) return;
      lastUpdate = new Date().toLocaleTimeString(lang, { hour12: false });
      document.querySelector("#chart-state").textContent =
        t("lastUpdated") + ": " + lastUpdate;
      document.querySelector("#retry-trade").hidden = true;
      drawCandles(detail.candles);
      document.querySelector("#chart-symbol").textContent = selected.replace(
        "USDT",
        " / USDT",
      );
      for (const [selector, items, cls] of [
        ["#book-asks", detail.book.asks.slice(0, 9).reverse(), "sell"],
        ["#book-bids", detail.book.bids.slice(0, 9), "buy"],
      ])
        document.querySelector(selector).innerHTML = items
          .map(
            (r, i) =>
              `<button type="button" data-book-price="${esc(r[0])}" aria-label="${t("price")} ${esc(r[0])} USDT" class="book-row ${cls}" style="--depth:${Math.max(1, Math.min(100, (Number(r[1]) / Math.max(...items.map((item) => Number(item[1])))) * 100))}%"><span>${money(r[0], 5)}</span><span>${money(r[1], 6)}</span></button>`,
          )
          .join("");
      document.querySelector("#market-trades").innerHTML = table(
        [t("price"), t("quantity"), t("date")],
        detail.trades
          .slice(0, 8)
          .map(
            (r) =>
              `<tr><td class="${r.isBuyerMaker ? "negative" : "change"}">${money(r.price, 5)}</td><td>${money(r.qty, 6)}</td><td>${esc(new Date(r.time).toLocaleTimeString(lang, { hour12: false }))}</td></tr>`,
          ),
      );
      const m = catalog.find((m) => m.symbol === selected);
      currentPrice = m?.price;
      document.querySelector("#trade-price").textContent = money(
        currentPrice,
        5,
      );
      document.querySelector("#trade-change").textContent = m?.change
        ? money(m.change) + "%"
        : "—";
      document
        .querySelector("#trade-change")
        .classList.toggle("negative", Number(m?.change) < 0);
      document.querySelector("#trade-volume").textContent = money(m?.volume, 0);
      document.querySelector("#quantity-asset").textContent = selected.replace(
        /USDT$/,
        "",
      );
      const lot = m?.filters?.find((f) => f.filterType === "LOT_SIZE");
      document.querySelector("#pair-rules").textContent = lot
        ? t("quantity") +
          ": " +
          t("minimum") +
          " " +
          lot.minQty +
          " · " +
          t("quantityStep") +
          " " +
          lot.stepSize
        : "";
      estimate();
      balance();
    } catch (e) {
      if (thisGeneration !== generation) return;
      currentPrice = null;
      document.querySelector("#retry-trade").hidden = false;
      document.querySelector("#trade-price").textContent = "—";
      document.querySelector("#trade-change").textContent = "—";
      document.querySelector("#trade-volume").textContent = "—";
      document.querySelector("#order-estimate").textContent = "—";
      document.querySelector("#chart-state").textContent =
        e.message +
        " · " +
        t("lastUpdated") +
        ": " +
        (lastUpdate || t("notUpdated"));
      document.querySelector("#candles").innerHTML = "";
      document.querySelector("#book-asks").innerHTML = empty();
      document.querySelector("#book-bids").innerHTML = "";
      document.querySelector("#market-trades").innerHTML = empty();
    }
  }
  function choosePair(value, strict = true) {
    const term = value.toUpperCase().replace(/\s|\//g, "");
    const match = catalog.find(
      (m) => m.supported && (m.symbol === term || m.asset === term),
    );
    if (match) {
      if (selected !== match.symbol) {
        selected = match.symbol;
        pairChanged();
        document.querySelector("#pair").value = selected;
        load();
      }
    } else if (strict)
      toast(t(catalog.length ? "unsupported" : "unavailable"), true);
  }
  document.querySelector("#pair-search").oninput = (e) =>
    choosePair(e.target.value, false);
  document.querySelector("#pair-search").onchange = (e) =>
    choosePair(e.target.value);
  document.querySelector("#pair-search").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      choosePair(e.target.value);
    }
  };
  document.querySelector("#pair-apply").onclick = () =>
    choosePair(document.querySelector("#pair-search").value);
  document.querySelector("#pair").onchange = (e) => {
    selected = e.target.value;
    pairChanged();
    load();
  };
  document.querySelectorAll("[data-interval]").forEach(
    (b) =>
      (b.onclick = () => {
        interval = b.dataset.interval;
        document
          .querySelectorAll("[data-interval]")
          .forEach((x) => x.classList.toggle("active", x === b));
        load();
      }),
  );
  orders(document.querySelector("#trade-orders"));
  onForm("#order-form", async (b) => {
    if (!currentPrice) throw Error(t("unavailable"));
    sessionStorage.setItem("oxion-order-key-" + me.user.uid, key);
    let quote;
    try {
      quote = await api("/orders/quote", {
        method: "POST",
        body: { ...b, symbol: selected, side },
        headers: { "Idempotency-Key": key },
      });
    } catch (error) {
      if (error.code === "IDEMPOTENCY_CONFLICT") {
        key = requestKey();
        sessionStorage.removeItem("oxion-order-key-" + me.user.uid);
      }
      throw error;
    }
    const ok = await confirmDialog(
      `${t(side === "BUY" ? "buy" : "sell")} · ${esc(quote.symbol)}<br>${t("quantity")}: ${esc(quote.quantity)}<br>${t("price")}: ${esc(quote.price)} USDT<br>${t("fee")}: ${esc(quote.fee)} USDT (0.10%)<br>${t("total")}: ${esc(quote.total)} USDT<p>${t("simulationOrder")}</p>`,
    );
    if (!ok) {
      key = requestKey();
      sessionStorage.removeItem("oxion-order-key-" + me.user.uid);
      return;
    }
    try {
      await api("/orders", {
        method: "POST",
        body: { quote_id: quote.id },
        headers: { "Idempotency-Key": key },
      });
    } catch (error) {
      if (
        ["QUOTE_EXPIRED", "QUOTE_CHANGED", "INSUFFICIENT_BALANCE"].includes(
          error.code,
        )
      ) {
        key = requestKey();
        sessionStorage.removeItem("oxion-order-key-" + me.user.uid);
      }
      throw error;
    }
    key = requestKey();
    sessionStorage.removeItem("oxion-order-key-" + me.user.uid);
    toast(t("orderCreated"));
    f.quantity.value = "";
    f.budget.value = "";
    estimate();
    orders(document.querySelector("#trade-orders"));
    balance();
  });
  async function initialize() {
    const controls = [
      ...document.querySelectorAll(
        "#pair,#pair-search,#pair-apply,[data-interval]",
      ),
    ];
    controls.forEach((c) => (c.disabled = true));
    document.querySelector("#chart-state").textContent = t("loading");
    try {
      catalog = (await api("/markets")).items;
      const supported = catalog.filter((m) => m.supported);
      if (!supported.length) throw Error(t("unavailable"));
      if (!supported.some((m) => m.symbol === selected))
        selected = supported[0]?.symbol || "BTCUSDT";
      document.querySelector("#pair").innerHTML = supported
        .map(
          (m) =>
            `<option value="${m.symbol}" ${m.symbol === selected ? "selected" : ""}>${m.asset} / USDT</option>`,
        )
        .join("");
      document.querySelector("#pair-options").innerHTML = catalog
        .filter((m) => m.supported)
        .map((m) => `<option value="${m.symbol}">${m.asset} / USDT</option>`)
        .join("");
      await load();
    } catch (e) {
      document.querySelector("#chart-state").textContent = e.message;
      document.querySelector("#retry-trade").hidden = false;
    }
    controls.forEach((c) => (c.disabled = false));
  }
  document.querySelector("#retry-trade").onclick = initialize;
  await initialize();
  setInterval(async () => {
    if (document.hidden) return;
    try {
      catalog = (await api("/markets")).items;
      const supported = catalog.filter((m) => m.supported);
      if (!supported.length) throw Error(t("unavailable"));
      if (!supported.some((m) => m.symbol === selected))
        selected = supported[0].symbol;
      document.querySelector("#pair").innerHTML = supported
        .map(
          (m) =>
            `<option value="${m.symbol}" ${m.symbol === selected ? "selected" : ""}>${m.asset} / USDT</option>`,
        )
        .join("");
      document.querySelector("#pair-options").innerHTML = supported
        .map((m) => `<option value="${m.symbol}">${m.asset} / USDT</option>`)
        .join("");
      await load();
    } catch (error) {
      currentPrice = null;
      document.querySelector("#chart-state").textContent =
        error.message +
        " · " +
        t("lastUpdated") +
        ": " +
        (lastUpdate || t("notUpdated"));
      document.querySelector("#retry-trade").hidden = false;
      for (const selector of [
        "#trade-price",
        "#trade-change",
        "#trade-volume",
        "#order-estimate",
      ])
        document.querySelector(selector).textContent = "—";
      document.querySelector("#candles").innerHTML = "";
      document.querySelector("#book-asks").innerHTML = empty();
      document.querySelector("#book-bids").innerHTML = "";
      document.querySelector("#market-trades").innerHTML = empty();
    }
  }, 15000);
}
function drawCandles(rows) {
  const values = rows.flatMap((r) => [Number(r[2]), Number(r[3])]);
  const min = Math.min(...values),
    max = Math.max(...values),
    range = max - min || 1;
  const y = (p) => 270 - ((Number(p) - min) / range) * 245;
  const step = 600 / rows.length;
  let svg = "";
  for (let i = 0; i < 5; i++) {
    const v = min + (range * i) / 4,
      yy = y(v);
    svg += `<line x1="0" x2="620" y1="${yy}" y2="${yy}" stroke="#edf0f5"/><text x="625" y="${yy + 4}" fill="#627189" font-size="10">${money(v, 2)}</text>`;
  }
  rows.forEach((r, i) => {
    const x = 10 + i * step,
      col = Number(r[4]) >= Number(r[1]) ? "#087b62" : "#be3a4c";
    svg += `<line x1="${x}" x2="${x}" y1="${y(r[2])}" y2="${y(r[3])}" stroke="${col}"/><rect x="${x - step * 0.28}" y="${Math.min(y(r[1]), y(r[4]))}" width="${step * 0.56}" height="${Math.max(1, Math.abs(y(r[1]) - y(r[4])))}" rx="1" fill="${col}"/>`;
  });
  document.querySelector("#candles").innerHTML = svg;
}
try {
  switch (page) {
    case "home":
      await home();
      break;
    case "markets":
      standard(marketTable(), "markets", "marketSub");
      await renderMarkets();
      break;
    case "trade":
      await trade();
      break;
    case "signup":
    case "login":
      await authPage();
      break;
    case "verify":
    case "forgot":
      await tokenPage();
      break;
    case "profile":
      await profile();
      break;
    case "security":
      await security();
      break;
    case "wallet":
      await wallet();
      break;
    case "deposit":
      await deposit();
      break;
    case "withdraw":
      await withdraw();
      break;
    case "orders":
      await orders();
      break;
    case "history":
      await history();
      break;
    case "support":
      await support();
      break;
    case "faq":
      standard(`<div class="panel">${faq()}</div>`);
      break;
    case "promotions":
      standard(`${notice(t("previewNotice"), "warn")}${promotions()}`);
      await activeCampaigns();
      break;
    case "promotionDetails":
      standard(
        `<div class="panel prose"><span class="label preview">${t("preview")}</span><h2>${t("bonusTitle")}</h2><p>${t("bonusSub")}</p>${notice(t("previewNotice"), "warn")}<p>${t("faq2a")}</p><a href="/promotions.html" class="btn outline">${t("promotions")}</a></div>`,
      );
      break;
    case "about":
    case "fees":
    case "terms":
    case "privacy":
    case "risk":
      standard(
        `<article class="panel prose">${["terms", "privacy", "risk"].includes(page) ? notice(t("legalDraft"), "warn") : ""}<h2>${t(page)}</h2><p>${t({ about: "aboutText", fees: "feeText", terms: "termsText", privacy: "privacyText", risk: "riskText" }[page])}</p><div class="divider"></div><p>${t("faq1a")}</p></article>`,
      );
      break;
    case "notfound":
      standard(
        `<div class="panel empty"><div class="metric">404</div><p>${t("notfoundText")}</p><a href="/index.html" class="btn primary">${t("backHome")}</a></div>`,
      );
      break;
    case "admin":
      await (await import("./admin.js")).renderAdmin({ standard, date });
      break;
    default:
      standard(notice(t("notfoundText")));
  }
} catch (e) {
  standard(notice(e.message, "error"));
}
export { t, standard, date };
