import {
  api,
  me,
  escape as esc,
  toast,
  notice,
  money,
  requestKey,
} from "./api.js";
import { t, lang } from "./i18n.js";
import { icon } from "./icons.js";
import { previewReturn } from "./directional-math.js";
const time = (v) =>
  new Date(Number(v)).toLocaleTimeString(
    { az: "az-AZ", en: "en-GB", tr: "tr-TR", ru: "ru-RU" }[lang],
    { hour12: false },
  );
const usd = (v) => "$" + money(v, 2);
const timer = (v) => {
  const n = Math.max(0, Math.ceil(v / 1000));
  return (
    Math.floor(n / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (n % 60).toString().padStart(2, "0")
  );
};
const resultText = (p) =>
  p.status === "won"
    ? `${t("won")} · ${t("netProfit")} +${usd(p.profit)}`
    : p.status === "lost"
      ? `${t("lost")} · ${t("lossLabel")} ${usd(p.stake)}`
      : `${t(p.status)} · ${usd(p.stake)} ${t("returned")}`;
function positionRows(items, now) {
  return items.length
    ? items
        .map(
          (p) =>
            `<article class="direction-position ${esc(p.status)}"><div><strong>${esc(p.asset.replace("USD", " / USD"))}</strong><span class="direction-tag ${p.direction === "UP" ? "up" : "down"}">${t(p.direction === "UP" ? "up" : "down")}</span><small>${time(p.opened_ms)} → ${time(p.expires_ms)}</small></div><div><strong>${usd(p.stake)}</strong><small>${t("payoutLabel")}: ${esc(p.payout)}%</small></div><div><small>${t("openedPrice")}: ${esc(p.open_price)}</small><small>${t("closedPrice")}: ${p.close_price ? esc(p.close_price) : "—"}</small></div><div>${p.status === "open" ? `<strong class="position-timer" data-expiry="${esc(p.expires_ms)}">${timer(Number(p.expires_ms) - now)}</strong>` : `<strong class="position-result ${esc(p.status)}">${esc(resultText(p))}</strong>`}<small>${esc(p.id.slice(0, 8))}</small></div></article>`,
        )
        .join("")
    : `<div class="direction-empty">${icon("history")}<p>${t("empty")}</p></div>`;
}
export async function renderDirectional(standard) {
  document.body.classList.add("directional-page");
  const stored =
    new URLSearchParams(location.search).get("asset") ||
    localStorage.getItem("oxion-directional-asset");
  let selected = [
      "XAUUSD",
      "XAGUSD",
      "BTCUSD",
      "ETHUSD",
      "EURUSD",
      "GBPUSD",
      "AAPL",
      "MSFT",
    ].includes(stored)
      ? stored
      : "XAUUSD",
    assets = [],
    series = [],
    positions = [],
    settings = { payout: "87", minimum: "1", maximum: "1000" },
    offset = 0,
    lastMarket = 0,
    category = "all",
    listTab = "open",
    pending = false,
    marketBusy = false,
    userBusy = false,
    opKey = null,
    fingerprint = null,
    windowSeconds = 60,
    boot = true;
  const pendingStore = "oxion-demo-pending-" + (me.user?.uid || "guest");
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingStore));
    opKey = saved?.key || null;
    fingerprint = saved?.signature || null;
  } catch {}
  let favorite = [];
  try {
    const x = JSON.parse(localStorage.getItem("oxion-demo-favorites") || "[]");
    if (Array.isArray(x)) favorite = x.filter((s) => typeof s === "string");
  } catch {}
  const seen = new Set();
  let lastBalance = null;
  standard(
    `<div class="directional-terminal"><aside class="direction-sidebar"><div class="direction-side-brand">OXION <span>DEMO</span></div><nav class="direction-quick">${[
      ["trade", "trade"],
      ["wallet", "wallet"],
      ["history", "history"],
      ["support", "support"],
    ]
      .map(
        ([p, i]) =>
          `<a href="/${p}.html" aria-label="${t(p)}">${icon(i)}<span>${t(p)}</span></a>`,
      )
      .join(
        "",
      )}</nav><label class="direction-search"><span class="hidden">${t("search")}</span><input id="direction-search" type="search" aria-label="${t("search")}" placeholder="${t("search")}"></label><div class="direction-categories">${["all", "favorites", "crypto", "metals", "forex", "stocks"].map((v, i) => `<button type="button" data-category="${v}" class="${i === 0 ? "active" : ""}">${t(v)}</button>`).join("")}</div><div id="direction-assets" class="direction-assets">${t("loading")}</div></aside><div class="direction-center"><div class="direction-market-heading"><div><span class="demo-chip">${t("demoBadge")}</span><h2 id="direction-pair">XAU / USD</h2><p>${t("simulatedPrices")}</p></div><div class="direction-live-price"><strong id="direction-price">—</strong><small id="direction-health" role="status">${t("loading")}</small></div></div><section class="direction-chart-card"><div class="direction-chart-tools"><span>${t("simulatedPrices")}</span><div>${[30, 60, 300].map((s) => `<button type="button" data-chart-window="${s}" class="${s === 60 ? "active" : ""}">${s < 60 ? s + "s" : s / 60 + "m"}</button>`).join("")}</div></div><canvas id="direction-chart" role="img" aria-label="${t("chart")}"></canvas><div class="direction-chart-bottom"><span id="direction-last">—</span><span>${t("demoVirtual")}</span></div></section><section class="direction-positions"><div class="direction-position-tabs"><button data-position-tab="open" class="active">${t("openPositions")} <span id="open-count">0</span></button><button data-position-tab="closed">${t("closedPositions")}</button><a href="/history.html">${t("history")} ${icon("arrow")}</a></div><div id="direction-positions">${me.user ? t("loading") : notice(t("authRequired"))}</div></section></div><aside class="direction-order"><div class="direction-account"><span>${t("demoBadge")}</span><strong id="direction-balance">—</strong><small>${t("demoVirtual")}</small></div><form id="direction-form"><label>${t("duration")}<select name="duration" id="direction-duration">${[3, 5, 15, 30, 60, 300].map((s) => `<option value="${s}" ${s === 3 ? "selected" : ""}>${s < 60 ? s + " s" : s / 60 + " min"}</option>`).join("")}</select></label><small id="duration-state" class="direction-hint"></small><label>${t("amount")}<span class="direction-stake"><button type="button" id="stake-less" aria-label="−">−</button><input name="amount" value="10" inputmode="decimal" autocomplete="off" pattern="[0-9]+([.][0-9]{1,2})?" required aria-label="${t("amount")}"><button type="button" id="stake-more" aria-label="+">+</button></span></label><div class="direction-payout"><span>${t("payoutLabel")}</span><strong id="direction-payout">87%</strong><small>${t("payoutExplain")}</small></div><div class="direction-return"><span>${t("potentialProfit")}<b id="direction-profit">$8.70</b></span><span>${t("potentialReturn")}<b id="direction-return">$18.70</b></span><span>${t("possibleLoss")}<b id="direction-loss">$10.00</b></span></div><div id="direction-error" role="status"></div><button type="button" id="direction-up" class="direction-button higher" disabled>${t("up")}</button><button type="button" id="direction-down" class="direction-button lower" disabled>${t("down")}</button>${!me.user ? `<a class="direction-login" href="/login.html">${t("login")}</a>` : !me.user.verified ? `<a href="/profile.html">${t("emailRequired")}</a>` : ""}<p class="direction-rule">${t("demoRules")}</p></form></aside></div>`,
  );
  const form = document.querySelector("#direction-form"),
    canvas = document.querySelector("#direction-chart"),
    ctx = canvas.getContext("2d");
  let geometry = { width: 0, height: 0, dpr: 1 };
  const now = () => Date.now() + offset;
  const changed = () => {
    opKey = null;
    fingerprint = null;
    sessionStorage.removeItem(pendingStore);
    updateReturn();
    setHealth();
  };
  function updateReturn() {
    const p = previewReturn(form.amount.value, settings.payout);
    document.querySelector("#direction-profit").textContent = p
      ? usd(p.profit)
      : "—";
    document.querySelector("#direction-return").textContent = p
      ? usd(p.credit)
      : "—";
    document.querySelector("#direction-loss").textContent = p
      ? usd(p.stake)
      : "—";
    document.querySelector("#direction-payout").textContent =
      settings.payout + "%";
  }
  function setHealth() {
    const asset = assets.find((a) => a.symbol === selected),
      stale = !lastMarket || Date.now() - lastMarket > 2500,
      healthy = asset?.healthy && !stale;
    document.querySelector("#direction-health").textContent = healthy
      ? t("sourceHealthy")
      : t("sourceStale");
    document
      .querySelector("#direction-health")
      .classList.toggle("bad", !healthy);
    let chosen = null;
    for (const option of form.duration.options) {
      const d = asset?.durations.find(
        (d) => d.seconds === Number(option.value),
      );
      option.disabled = !healthy || !d?.enabled;
      if (option.selected) chosen = d;
    }
    document.querySelector("#duration-state").textContent = !healthy
      ? t("sourceStale")
      : chosen?.enabled
        ? ""
        : t("feedSlow");
    const disabled =
      pending ||
      !me.user ||
      !me.user.verified ||
      !healthy ||
      !chosen?.enabled ||
      !previewReturn(form.amount.value, settings.payout) ||
      Number(form.amount.value) < Number(settings.minimum) ||
      Number(form.amount.value) > Number(settings.maximum);
    document.querySelector("#direction-up").disabled = disabled;
    document.querySelector("#direction-down").disabled = disabled;
  }
  function renderAssets() {
    const term = document
      .querySelector("#direction-search")
      .value.toLowerCase();
    document.querySelector("#direction-assets").innerHTML =
      assets
        .filter(
          (a) =>
            (category === "all" ||
              (category === "favorites" && favorite.includes(a.symbol)) ||
              category === a.category) &&
            a.label.toLowerCase().includes(term),
        )
        .map(
          (a) =>
            `<div class="direction-asset ${a.symbol === selected ? "active" : ""}"><button type="button" data-asset="${esc(a.symbol)}"><strong>${esc(a.label)}</strong><small>${t(a.category)}</small></button><button type="button" data-favorite="${esc(a.symbol)}" aria-label="${t("favorites")} ${esc(a.label)}" aria-pressed="${favorite.includes(a.symbol)}">${favorite.includes(a.symbol) ? "★" : "☆"}</button></div>`,
        )
        .join("") || `<p class="direction-hint">${t("empty")}</p>`;
    document.querySelectorAll("[data-asset]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.asset;
          localStorage.setItem("oxion-directional-asset", selected);
          series = [];
          changed();
          renderAssets();
          loadMarket();
        }),
    );
    document.querySelectorAll("[data-favorite]").forEach(
      (b) =>
        (b.onclick = () => {
          const symbol = b.dataset.favorite;
          favorite = favorite.includes(symbol)
            ? favorite.filter((s) => s !== symbol)
            : [...favorite, symbol];
          localStorage.setItem(
            "oxion-demo-favorites",
            JSON.stringify(favorite),
          );
          renderAssets();
        }),
    );
  }
  function renderPositions() {
    const rows = positions.filter((p) =>
      listTab === "open" ? p.status === "open" : p.status !== "open",
    );
    document.querySelector("#open-count").textContent = String(
      positions.filter((p) => p.status === "open").length,
    );
    document.querySelector("#direction-positions").innerHTML = me.user
      ? positionRows(rows, now())
      : notice(t("authRequired"));
  }
  async function loadMarket() {
    if (marketBusy) return;
    marketBusy = true;
    const requested = selected,
      started = Date.now();
    try {
      const r = await api(
        "/demo/market?asset=" + encodeURIComponent(requested),
      );
      if (requested !== selected) return;
      offset = r.server_ms - (started + Date.now()) / 2;
      assets = r.assets;
      settings = r.settings;
      series = r.series.map((p) => ({
        ...p,
        at_ms: Number(p.at_ms),
        price: Number(p.price),
      }));
      lastMarket = Date.now();
      const asset = assets.find((a) => a.symbol === selected);
      if (!asset) {
        selected = assets[0].symbol;
        return;
      }
      document.querySelector("#direction-pair").textContent = asset.label;
      document.querySelector("#direction-price").textContent = asset.price
        ? money(asset.price, asset.category === "forex" ? 6 : 4)
        : "—";
      document.querySelector("#direction-last").textContent = asset.tick_ms
        ? time(asset.tick_ms) + " · simulation-v1"
        : "—";
      form.amount.min = settings.minimum;
      form.amount.max = settings.maximum;
      updateReturn();
      renderAssets();
      setHealth();
    } catch (e) {
      lastMarket = 0;
      document.querySelector("#direction-error").innerHTML = notice(
        e.message,
        "error",
      );
      setHealth();
    } finally {
      marketBusy = false;
    }
  }
  async function loadUser() {
    if (!me.user || userBusy) return;
    userBusy = true;
    try {
      const [account, r] = await Promise.all([
        api("/demo/account"),
        api("/demo/positions"),
      ]);
      document.querySelector("#direction-balance").textContent = usd(
        account.available,
      );
      positions = r.items.map((p) => ({
        ...p,
        opened_ms: Number(p.opened_ms),
        expires_ms: Number(p.expires_ms),
      }));
      if (!boot)
        for (const p of positions) {
          if (p.status !== "open" && !seen.has(p.id))
            toast(resultText(p), p.status === "lost");
        }
      for (const p of positions) if (p.status !== "open") seen.add(p.id);
      boot = false;
      renderPositions();
      if (account.available !== lastBalance) {
        lastBalance = account.available;
        window.dispatchEvent(new Event("oxion:balance-changed"));
      }
    } catch (e) {
      document.querySelector("#direction-error").innerHTML = notice(
        e.message,
        "error",
      );
    } finally {
      userBusy = false;
    }
  }
  async function open(direction) {
    if (pending) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!previewReturn(form.amount.value, settings.payout)) return;
    const body = {
      asset: selected,
      amount: form.amount.value,
      duration: Number(form.duration.value),
      direction,
      settings_id: settings.id,
    };
    const signature = JSON.stringify(body);
    if (signature !== fingerprint) {
      opKey = requestKey();
      fingerprint = signature;
      sessionStorage.setItem(
        pendingStore,
        JSON.stringify({ key: opKey, signature }),
      );
    }
    pending = true;
    setHealth();
    document.querySelector("#direction-error").innerHTML = "";
    try {
      await api("/demo/positions", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": opKey },
      });
      opKey = null;
      fingerprint = null;
      sessionStorage.removeItem(pendingStore);
      await loadUser();
    } catch (e) {
      document.querySelector("#direction-error").innerHTML = notice(
        e.message,
        "error",
      );
      if (["DEMO_RULES_CHANGED", "DEMO_LIMIT"].includes(e.code)) loadMarket();
    } finally {
      pending = false;
      setHealth();
    }
  }
  form.onsubmit = (e) => e.preventDefault();
  form.amount.oninput = changed;
  form.duration.onchange = () => {
    changed();
    setHealth();
  };
  for (const [id, delta] of [
    ["stake-less", -1],
    ["stake-more", 1],
  ])
    document.querySelector("#" + id).onclick = () => {
      const v = Number(form.amount.value);
      form.amount.value = Math.max(
        Number(settings.minimum),
        Math.min(
          Number(settings.maximum),
          (Number.isFinite(v) ? v : 10) + delta,
        ),
      ).toFixed(2);
      changed();
    };
  document.querySelector("#direction-up").onclick = () => open("UP");
  document.querySelector("#direction-down").onclick = () => open("DOWN");
  document.querySelector("#direction-search").oninput = renderAssets;
  document.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        document
          .querySelectorAll("[data-category]")
          .forEach((x) => x.classList.toggle("active", x === b));
        renderAssets();
      }),
  );
  document.querySelectorAll("[data-position-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        listTab = b.dataset.positionTab;
        document
          .querySelectorAll("[data-position-tab]")
          .forEach((x) => x.classList.toggle("active", x === b));
        renderPositions();
      }),
  );
  document.querySelectorAll("[data-chart-window]").forEach(
    (b) =>
      (b.onclick = () => {
        windowSeconds = Number(b.dataset.chartWindow);
        document
          .querySelectorAll("[data-chart-window]")
          .forEach((x) => x.classList.toggle("active", x === b));
      }),
  );
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    geometry = {
      width: rect.width,
      height: rect.height,
      dpr: devicePixelRatio || 1,
    };
    canvas.width = rect.width * geometry.dpr;
    canvas.height = rect.height * geometry.dpr;
  });
  resize.observe(canvas);
  function draw() {
    const { width: w, height: h, dpr } = geometry;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!series.length) {
      ctx.fillStyle = "#7d96b3";
      ctx.font = "14px system-ui";
      ctx.fillText(t("sourceStale"), 25, h / 2);
      return;
    }
    const active = positions
        .filter((p) => p.status === "open" && p.asset === selected)
        .slice(0, 5),
      at = now(),
      start = at - windowSeconds * 1000,
      end = Math.max(
        at + Number(form.duration.value) * 1000,
        ...active.map((p) => p.expires_ms),
      ),
      points = series.filter((p) => p.at_ms >= start),
      prices = [
        ...points.map((p) => p.price),
        ...active.map((p) => Number(p.open_price)),
      ];
    if (!prices.length) return;
    const low = Math.min(...prices),
      high = Math.max(...prices),
      pad = Math.max((high - low) * 0.18, Math.abs(high) * 0.00001),
      min = low - pad,
      max = high + pad,
      x = (v) => 20 + ((v - start) / (end - start)) * (w - 104),
      y = (v) => h - 35 - ((v - min) / (max - min)) * (h - 65);
    ctx.font = "10px system-ui";
    for (let i = 0; i < 5; i++) {
      const yy = 25 + ((h - 60) * i) / 4;
      ctx.strokeStyle = "#20334a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15, yy);
      ctx.lineTo(w - 80, yy);
      ctx.stroke();
      ctx.fillStyle = "#7690aa";
      ctx.fillText(
        (max - ((max - min) * i) / 4).toFixed(
          selected.includes("EUR") || selected.includes("GBP") ? 5 : 2,
        ),
        w - 74,
        yy + 4,
      );
    }
    ctx.strokeStyle = "#1fd1c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i) ctx.lineTo(x(p.at_ms), y(p.price));
      else ctx.moveTo(x(p.at_ms), y(p.price));
    });
    ctx.stroke();
    const last = points.at(-1);
    if (last) {
      ctx.fillStyle = "#1fd1c7";
      ctx.beginPath();
      ctx.arc(x(last.at_ms), y(last.price), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of positions
      .filter(
        (p) =>
          p.asset === selected &&
          p.status !== "open" &&
          p.close_tick_ms >= start &&
          p.close_price,
      )
      .slice(0, 3)) {
      ctx.fillStyle =
        p.status === "won"
          ? "#40d7a2"
          : p.status === "lost"
            ? "#fa7d8e"
            : "#d3deea";
      ctx.beginPath();
      ctx.arc(
        x(Number(p.close_tick_ms)),
        y(Number(p.close_price)),
        6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (const p of active) {
      const color = p.direction === "UP" ? "#40d7a2" : "#fa7d8e",
        xx = x(p.opened_ms),
        yy = y(Number(p.open_price));
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(Math.max(20, xx), yy);
      ctx.lineTo(x(p.expires_ms), yy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x(p.expires_ms), 20);
      ctx.lineTo(x(p.expires_ms), h - 30);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(Math.max(20, xx), yy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "11px system-ui";
      ctx.fillText(
        (p.direction === "UP" ? "↑ " : "↓ ") + Number(p.open_price).toFixed(4),
        Math.max(20, xx) + 8,
        yy - 9,
      );
      ctx.fillText(
        timer(p.expires_ms - at),
        Math.min(w - 120, x(p.expires_ms) + 4),
        38,
      );
    }
    ctx.fillStyle = "#7690aa";
    ctx.font = "10px system-ui";
    for (let i = 0; i < 4; i++) {
      const tt = start + ((end - start) * i) / 3;
      ctx.fillText(time(tt), Math.min(w - 130, x(tt)), h - 12);
    }
  }
  let alive = true;
  const frame = () => {
    if (!alive) return;
    draw();
    document
      .querySelectorAll(".position-timer")
      .forEach(
        (el) => (el.textContent = timer(Number(el.dataset.expiry) - now())),
      );
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  await Promise.all([loadMarket(), loadUser()]);
  const marketTimer = setInterval(() => {
      if (!document.hidden) {
        loadMarket();
        setHealth();
      }
    }, 1000),
    userTimer = setInterval(() => {
      if (!document.hidden) loadUser();
    }, 2000);
  window.addEventListener(
    "pagehide",
    () => {
      alive = false;
      resize.disconnect();
      clearInterval(marketTimer);
      clearInterval(userTimer);
    },
    { once: true },
  );
}
export async function renderDemoHistory(standard) {
  if (!me.user) {
    standard(notice(t("authRequired")));
    return;
  }
  const r = await api("/demo/positions");
  standard(
    `<section class="panel demo-history"><span class="demo-chip">${t("demoBadge")}</span><h2>${t("history")}</h2><p class="hint">${t("demoVirtual")}</p>${positionRows(r.items, Date.now())}<details id="legacy-journal"><summary>${t("legacyHistory")}</summary><div id="legacy-history"></div></details></section>`,
  );
  document.querySelector("#legacy-journal").ontoggle = async (e) => {
    if (!e.target.open || e.target.dataset.loaded) return;
    e.target.dataset.loaded = "true";
    try {
      const data = await api("/history");
      document.querySelector("#legacy-history").textContent = JSON.stringify(
        data.items,
        null,
        2,
      );
    } catch (e) {
      document.querySelector("#legacy-history").textContent = e.message;
    }
  };
}
