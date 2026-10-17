import { api, escape as esc, table, money, notice, toast } from "./api.js";
import { t, lang } from "./i18n.js";
import { assetLogo } from "./asset-logos.js";
import { icon } from "./icons.js";
const words = {
  az: [
    "Depozitlər",
    "Çıxarışlar",
    "Əməliyyat tap",
    "Hesab hərəkətləri",
    "Yoxlanılır",
    "Təsdiqlənib",
    "Uğursuz",
    "Ətraflı",
    "Şəbəkə",
    "Açıq",
    "Tamamlanmış",
  ],
  en: [
    "Deposits",
    "Withdrawals",
    "Find a transaction",
    "Account movements",
    "Under review",
    "Confirmed",
    "Failed",
    "Details",
    "Network",
    "Open",
    "Completed",
  ],
  tr: [
    "Yatırmalar",
    "Çekimler",
    "İşlem bul",
    "Hesap hareketleri",
    "İnceleniyor",
    "Onaylandı",
    "Başarısız",
    "Ayrıntılar",
    "Ağ",
    "Açık",
    "Tamamlanan",
  ],
  ru: [
    "Депозиты",
    "Выводы",
    "Найти операцию",
    "Движения по счёту",
    "На проверке",
    "Подтверждено",
    "Ошибка",
    "Подробнее",
    "Сеть",
    "Открытые",
    "Завершённые",
  ],
};
const w = (i) => (words[lang] || words.az)[i];
const stamp = (v) =>
  new Intl.DateTimeFormat(
    { az: "az-AZ", en: "en-US", tr: "tr-TR", ru: "ru-RU" }[lang],
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(v));
const empty = () =>
  `<div class="history-empty">${icon("history")}<strong>${t("empty")}</strong><p>${t("emptyDesc")}</p></div>`;
export async function renderHistory(standard, statusLabel) {
  const [claims, deposits, withdrawals, ledger] = await Promise.all([
    api("/deposit/requests"),
    api("/deposits"),
    api("/withdrawals"),
    api("/history"),
  ]);
  const items = [
    ...claims.items.map((d) => ({ ...d, type: "deposit" })),
    ...deposits.items.map((d) => ({ ...d, type: "deposit" })),
    ...withdrawals.items.map((d) => ({ ...d, type: "withdraw" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  standard(
    `<section class="history-sheet"><div class="profile-sheet-heading"><span>${t("history")}</span><a class="profile-close" href="/profile.html" aria-label="${t("profile")}">×</a></div><div class="soft-tabs" aria-label="${t("history")}"><button data-history-tab="all" class="active" aria-pressed="true">${t("all")}</button><button data-history-tab="deposit" aria-pressed="false">${w(0)}</button><button data-history-tab="withdraw" aria-pressed="false">${w(1)}</button></div><label class="history-search">${icon("search")}<span class="hidden">${w(2)}</span><input id="history-search" type="search" aria-label="${w(2)}" placeholder="${w(2)} · TXID"></label><div id="history-list"></div><details class="ledger-details"><summary>${w(3)}</summary>${table(
      [
        t("action"),
        t("asset"),
        t("status"),
        t("amount"),
        t("before"),
        t("after"),
      ],
      ledger.items.map(
        (h) =>
          `<tr><td>${esc(statusLabel(h.kind))}</td><td>${esc(h.asset)}</td><td>${t({ available: "available", locked: "locked", bonus: "bonus", manual: "manual" }[h.bucket] || "status")}</td><td>${esc(h.amount)}</td><td>${esc(h.before_balance)}</td><td>${esc(h.after_balance)}</td></tr>`,
      ),
    )}</details></section>`,
  );
  let filter = "all",
    search = "";
  const render = () => {
    const filtered = items.filter(
      (i) =>
        (filter === "all" || i.type === filter) &&
        [i.asset, i.network, i.txid, i.id]
          .join(" ")
          .toLowerCase()
          .includes(search),
    );
    document.querySelector("#history-list").innerHTML = filtered.length
      ? filtered
          .map((i) => {
            const done = ["confirmed", "completed"].includes(i.status),
              failed = ["failed", "rejected", "cancelled"].includes(i.status),
              state = done ? w(5) : failed ? w(6) : w(4);
            return `<article class="history-item">${assetLogo(i.asset)}<div class="history-item-main"><strong>${esc(i.asset)} <span>${esc(i.network)}</span></strong><span class="history-status ${done ? "success" : failed ? "failed" : "pending"}">${done ? "✓" : failed ? "×" : "◷"} ${state}</span><details><summary>${w(7)}</summary><p>${t("action")}: ${t(i.type === "deposit" ? "deposit" : "withdraw")}</p>${i.txid ? `<p>TXID: <code>${esc(i.txid)}</code></p>` : ""}${i.address ? `<p>${t("address")}: <code>${esc(i.address)}</code></p>` : ""}${i.reason ? `<p>${esc(i.reason)}</p>` : ""}</details></div><div class="history-item-amount"><strong>${i.type === "deposit" ? "+" : "−"}${esc(money(i.amount, 8))}</strong><small>${esc(i.asset)}</small><time datetime="${esc(i.created_at)}">${esc(stamp(i.created_at))}</time></div></article>`;
          })
          .join("")
      : empty();
  };
  document.querySelectorAll("[data-history-tab]").forEach(
    (btn) =>
      (btn.onclick = () => {
        filter = btn.dataset.historyTab;
        document.querySelectorAll("[data-history-tab]").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        render();
      }),
  );
  document.querySelector("#history-search").oninput = (e) => {
    search = e.target.value.trim().toLowerCase();
    render();
  };
  render();
}
export async function renderOrders(standard, statusLabel) {
  const { items } = await api("/orders");
  standard(
    `<section class="history-sheet orders-sheet"><div class="profile-sheet-heading"><span>${t("orders")}</span><a class="profile-close" href="/profile.html" aria-label="${t("profile")}">×</a></div>${notice(t("simulationOrder"))}<div class="soft-tabs"><button data-order-tab="all" class="active" aria-pressed="true">${t("all")}</button><button data-order-tab="open" aria-pressed="false">${w(9)}</button><button data-order-tab="closed" aria-pressed="false">${w(10)}</button></div><div id="orders-list"></div></section>`,
  );
  let filter = "all";
  const open = (o) => ["open", "partial"].includes(o.status);
  const render = () => {
    const rows = items.filter(
      (o) => filter === "all" || (filter === "open" ? open(o) : !open(o)),
    );
    document.querySelector("#orders-list").innerHTML = rows.length
      ? rows
          .map(
            (o) =>
              `<article class="order-item"><div class="order-item-heading">${assetLogo(o.symbol.replace(/USDT$/, ""))}<span><strong>${esc(o.symbol.replace(/USDT$/, " / USDT"))}</strong><small>${esc(stamp(o.created_at))}</small></span><span class="badge ${o.side === "BUY" ? "ok" : ""}">${t(o.side === "BUY" ? "buy" : "sell")}</span></div><div class="order-item-data"><span>${t("quantity")}<strong>${esc(money(o.filled, 8))} / ${esc(money(o.quantity, 8))}</strong></span><span>${t("price")}<strong>${esc(money(o.price, 8))} USDT</strong></span></div><div class="order-item-footer"><span>${t(o.type === "LIMIT" ? "limit" : "market")} · ${statusLabel(o.status)}<small>${t(o.execution_mode === "binance-testnet" ? "testnet" : "testMode")}</small></span>${open(o) ? `<button class="btn small soft" data-order-cancel="${esc(o.id)}">${t("cancel")}</button>` : ""}</div></article>`,
          )
          .join("")
      : empty();
    document.querySelectorAll("[data-order-cancel]").forEach(
      (btn) =>
        (btn.onclick = async () => {
          btn.disabled = true;
          try {
            await api("/orders/" + btn.dataset.orderCancel, {
              method: "DELETE",
            });
            await renderOrders(standard, statusLabel);
          } catch (e) {
            toast(e.message, true);
            btn.disabled = false;
          }
        }),
    );
  };
  document.querySelectorAll("[data-order-tab]").forEach(
    (btn) =>
      (btn.onclick = () => {
        filter = btn.dataset.orderTab;
        document.querySelectorAll("[data-order-tab]").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        render();
      }),
  );
  render();
}
