import { api, me, escape as esc, notice, table, money, onForm } from "./api.js";
import { t } from "./i18n.js";
export async function renderDirectionalAdmin({ standard, date }) {
  if (me.user?.role !== "admin" || !me.user.totp) {
    standard(notice(t("adminDenied"), "error"));
    return;
  }
  let data = await api("/admin/demo"),
    section = "overview";
  standard(
    `<div class="admin-layout"><aside class="panel admin-nav">${["overview", "user", "positions", "ledger", "settings"].map((v, i) => `<button data-demo-admin="${v}" class="${i === 0 ? "active" : ""}">${t({ overview: "demoBadge", user: "user", positions: "orders", ledger: "audit", settings: "demoSettings" }[v])}</button>`).join("")}</aside><div class="stack" id="demo-admin-body"></div></div>`,
  );
  const target = document.querySelector("#demo-admin-body");
  async function render() {
    document
      .querySelectorAll("[data-demo-admin]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.demoAdmin === section),
      );
    if (section === "overview")
      target.innerHTML = `<section class="panel"><span class="demo-chip">${t("demoBadge")}</span><h2>${t("sourceHealth")}</h2><p class="hint">${t("simulatedPrices")} · ${t("demoVirtual")}</p>${table(
        [t("asset"), t("price"), t("status")],
        data.assets.map(
          (a) =>
            `<tr><td>${esc(a.label)}</td><td>${esc(a.price || "—")}</td><td>${t(a.healthy ? "sourceHealthy" : "sourceStale")}</td></tr>`,
        ),
      )}</section><section class="panel"><h3>${t("demoSettings")}</h3><p>${t("payoutLabel")}: <strong>${esc(data.settings.payout)}%</strong></p><p>${t("minimum")}: $${esc(data.settings.minimum)} · ${t("maximum")}: $${esc(data.settings.maximum)}</p>${notice(t("demoSettingsNote"))}</section>`;
    if (section === "user") {
      target.innerHTML = `<section class="panel"><h2>${t("user")}</h2><form id="demo-user-search"><label>${t("userSearch")}<input name="q" type="search"></label><button class="btn primary">${t("search")}</button><div data-result></div></form><div id="demo-users"></div></section>`;
      onForm("#demo-user-search", async (b) => {
        const r = await api("/admin/users?q=" + encodeURIComponent(b.q));
        document.querySelector("#demo-users").innerHTML = table(
          ["UID", t("email"), t("status")],
          r.items.map(
            (u) =>
              `<tr><td>${esc(u.uid)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td></tr>`,
          ),
        );
      });
    }
    if (section === "positions")
      target.innerHTML = `<section class="panel"><h2>${t("orders")}</h2><p class="hint">${t("demoSettingsNote")}</p>${table(
        [
          "UID",
          t("asset"),
          t("action"),
          t("amount"),
          t("payoutLabel"),
          t("openedPrice"),
          t("closedPrice"),
          t("status"),
        ],
        data.positions.map(
          (p) =>
            `<tr><td>${esc(p.uid)}</td><td>${esc(p.asset)}</td><td>${t(p.direction === "UP" ? "up" : "down")}</td><td>$${esc(p.stake)}</td><td>${esc(p.payout)}%</td><td>${esc(p.open_price)}</td><td>${esc(p.close_price || "—")}</td><td>${t(p.status === "open" ? "openPositions" : p.status)}</td></tr>`,
        ),
      )}</section>`;
    if (section === "ledger")
      target.innerHTML = `<section class="panel"><h2>${t("audit")}</h2><p class="hint">${t("demoVirtual")}</p>${table(
        [
          "UID",
          t("action"),
          t("status"),
          t("amount"),
          t("before"),
          t("after"),
          t("date"),
        ],
        data.ledger.map(
          (j) =>
            `<tr><td>${esc(j.uid || "—")}</td><td>${esc(j.kind)}</td><td>${esc(j.bucket)}</td><td>$${esc(j.amount)}</td><td>$${esc(j.before_balance)}</td><td>$${esc(j.after_balance)}</td><td>${date(j.created_at)}</td></tr>`,
        ),
      )}</section>`;
    if (section === "settings") {
      target.innerHTML = `<section class="panel"><h2>${t("demoSettings")}</h2>${notice(t("demoSettingsNote"))}<form id="demo-settings"><label>${t("payoutLabel")} (%)<input name="payout" value="${esc(data.settings.payout)}" required inputmode="decimal"></label><label>${t("minimum")} ($)<input name="minimum" value="${esc(data.settings.minimum)}" required inputmode="decimal"></label><label>${t("maximum")} ($)<input name="maximum" value="${esc(data.settings.maximum)}" required inputmode="decimal"></label><label>${t("reason")}<input name="reason" required minlength="8" maxlength="500"></label><div data-result></div><button class="btn primary">${t("save")}</button></form></section><section class="panel"><h3>${t("settingsAudit")}</h3>${table(
        [t("payoutLabel"), t("minimum"), t("maximum"), t("reason"), t("date")],
        data.versions.map(
          (v) =>
            `<tr><td>${esc(v.payout)}%</td><td>${esc(v.minimum)}</td><td>${esc(v.maximum)}</td><td>${esc(v.reason)}</td><td>${date(v.created_at)}</td></tr>`,
        ),
      )}</section>`;
      onForm("#demo-settings", async (b) => {
        await api("/admin/demo/settings", { method: "POST", body: b });
        data = await api("/admin/demo");
        await render();
      });
    }
  }
  document.querySelectorAll("[data-demo-admin]").forEach(
    (b) =>
      (b.onclick = async () => {
        section = b.dataset.demoAdmin;
        data = await api("/admin/demo");
        await render();
      }),
  );
  await render();
}
