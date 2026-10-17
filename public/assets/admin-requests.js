import {
  api,
  escape as esc,
  onForm,
  notice,
  empty,
  money,
  toast,
  confirmAction,
} from "./api.js";
import { t, lang } from "./i18n.js";
import { assetLogo } from "./asset-logos.js";
const stamp = (v) =>
  new Intl.DateTimeFormat(
    { az: "az-AZ", en: "en-US", tr: "tr-TR", ru: "ru-RU" }[lang],
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(v));
const state = (s) =>
  t(
    {
      awaiting_review: "requestsWaiting",
      confirmed: "manualDeposit",
      failed: "rejected",
      rejected: "rejected",
      completed: "completed",
      processing: "loading",
    }[s] || "status",
  );
export async function renderRequests(target) {
  let selected = "deposit",
    pending = true,
    search = "",
    data = { deposit: [], withdraw: [] },
    busy = false;
  target.innerHTML = `<section class="panel request-inbox"><div class="request-inbox-heading"><h2>${t("requests")}</h2><button id="requests-refresh" class="btn small soft">${t("requestsRefresh")}</button></div><div class="soft-tabs" role="tablist" aria-label="${t("requests")}"><button data-request-tab="deposit" role="tab" aria-selected="true" aria-controls="request-list" class="active">${t("requestsDeposits")} <span id="deposit-count"></span></button><button data-request-tab="withdraw" role="tab" aria-selected="false" aria-controls="request-list">${t("requestsWithdrawals")} <span id="withdraw-count"></span></button></div><div class="request-filters"><input id="requests-search" type="search" aria-label="${t("requestsSearch")}" placeholder="${t("requestsSearch")}"><label><input type="checkbox" id="requests-pending" checked> ${t("requestsWaiting")}</label></div><div id="requests-error" role="status"></div><div id="request-list" role="tabpanel">${notice(t("loading"))}</div></section>`;
  const root = target.querySelector(".request-inbox");
  const list = target.querySelector("#request-list");
  function render() {
    const rows = data[selected].filter(
      (r) =>
        (!pending || r.status === "awaiting_review") &&
        [r.uid, r.email, r.id, r.asset, r.network]
          .join(" ")
          .toLowerCase()
          .includes(search),
    );
    list.innerHTML =
      (selected === "withdraw"
        ? notice(t("withdrawUnavailable"), "warn")
        : "") +
      (rows.length
        ? rows
            .map(
              (r, i) =>
                `<article class="request-card"><div class="request-card-heading">${assetLogo(r.asset)}<div><strong>${esc(r.uid)}</strong><small>${esc(r.email)}</small></div><span class="badge ${r.status === "confirmed" ? "ok" : ""}">${esc(state(r.status))}</span></div><div class="request-amount">${esc(money(r.amount, 8))} <small>${esc(r.asset)}</small><span>${esc(r.network)}</span></div><div class="request-meta"><span>${esc(stamp(r.created_at))}</span><small>#${esc(r.id.slice(0, 12))}</small></div><details class="request-address"><summary>${t("address")}</summary><code>${esc(r.address)}</code>${r.memo ? `<p>${t("memo")}: ${esc(r.memo)}</p>` : ""}</details>${selected === "deposit" && r.status === "awaiting_review" ? `<form id="deposit-review-${i}" data-review="${esc(r.id)}"><label>${t("reason")}<input name="reason" required minlength="8" maxlength="500"></label><label>${t("action")}<select name="decision"><option value="reject">${t("reject")}</option><option value="approve">${t("confirm")}</option></select></label><label class="request-check"><input type="checkbox" name="verified"> <span>${t("requestsCheck")}</span></label><p class="hint">${t("requestsManualHint")}</p><div data-result></div><button class="btn primary">${t("save")}</button></form>` : selected === "withdraw" && r.status === "awaiting_review" ? `<div class="request-withdraw-footer"><span>${t("fee")}: ${esc(r.fee)} ${esc(r.asset)}</span><button class="btn small danger" data-withdraw-reject="${esc(r.id)}">${t("reject")}</button></div>` : ""}</article>`,
            )
            .join("")
        : empty());
    list.querySelectorAll("[data-review]").forEach((f) => {
      f.addEventListener("input", () => (f.dataset.dirty = "true"));
      f.addEventListener("change", () => (f.dataset.dirty = "true"));
      f.elements.decision.onchange = () =>
        (f.elements.verified.required =
          f.elements.decision.value === "approve");
      onForm("#" + f.id, async (b) => {
        await api("/admin/deposit-requests/" + f.dataset.review + "/review", {
          method: "POST",
          body: {
            approve: b.decision === "approve",
            verified: f.elements.verified.checked,
            reason: b.reason,
          },
        });
        toast(t("saved"));
        await load();
      });
    });
    list.querySelectorAll("[data-withdraw-reject]").forEach(
      (btn) =>
        (btn.onclick = async () => {
          if (
            !(await confirmAction(
              esc(t("reject")) + " · " + esc(btn.dataset.withdrawReject),
            ))
          )
            return;
          btn.disabled = true;
          try {
            await api(
              "/admin/withdrawals/" + btn.dataset.withdrawReject + "/review",
              { method: "POST", body: { approve: false } },
            );
            toast(t("saved"));
            await load();
          } catch (e) {
            toast(e.message, true);
            btn.disabled = false;
          }
        }),
    );
  }
  async function load() {
    if (busy || !root.isConnected) return;
    busy = true;
    const button = target.querySelector("#requests-refresh");
    button.disabled = true;
    try {
      const [d, w] = await Promise.all([
        api("/admin/deposit-requests"),
        api("/admin/withdrawal-requests"),
      ]);
      if (!root.isConnected) return;
      data = { deposit: d.items, withdraw: w.items };
      const dc = d.items.filter((r) => r.status === "awaiting_review").length,
        wc = w.items.filter((r) => r.status === "awaiting_review").length;
      target.querySelector("#deposit-count").textContent = String(dc);
      target.querySelector("#withdraw-count").textContent = String(wc);
      const nav = document.querySelector('[data-section="requests"]');
      if (nav)
        nav.innerHTML =
          esc(t("requests")) + ` <span class="request-count">${dc + wc}</span>`;
      target.querySelector("#requests-error").innerHTML = "";
      render();
    } catch (e) {
      if (target.querySelector("#requests-error"))
        target.querySelector("#requests-error").innerHTML = notice(
          e.message,
          "error",
        );
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
  target.querySelectorAll("[data-request-tab]").forEach(
    (btn) =>
      (btn.onclick = () => {
        selected = btn.dataset.requestTab;
        target.querySelectorAll("[data-request-tab]").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-selected", String(active));
        });
        render();
      }),
  );
  target.querySelector("#requests-pending").onchange = (e) => {
    pending = e.target.checked;
    render();
  };
  target.querySelector("#requests-search").oninput = (e) => {
    search = e.target.value.trim().toLowerCase();
    render();
  };
  target.querySelector("#requests-refresh").onclick = load;
  await load();
  const timer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(timer);
      return;
    }
    if (
      !document.hidden &&
      !target.querySelector('form[data-dirty="true"],form[aria-busy="true"]')
    )
      load();
  }, 30000);
}
