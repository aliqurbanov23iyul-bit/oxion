import {
  api,
  me,
  escape as esc,
  toast,
  notice,
  empty,
  table,
  field,
  onForm,
  money,
  requestKey,
  confirmAction,
} from "./api.js";
import { t } from "./i18n.js";
export async function renderAdmin({ standard, date }) {
  if (me.user?.role !== "admin" || !me.user?.totp) {
    standard(notice(t("adminDenied"), "error"));
    return;
  }
  standard(
    `<div class="admin-layout"><aside class="panel admin-nav">${["user", "deposit", "withdraw", "orders", "tickets", "promotions", "audit"].map((k, i) => `<button data-section="${k}" class="${i === 0 ? "active" : ""}">${t(k)}</button>`).join("")}<details><summary>${t("advancedTools")}</summary><button data-section="testnet">Binance Testnet</button></details></aside><div class="stack" id="admin-body"></div></div>`,
  );
  const overview = await api("/admin/overview");
  let section = "user";
  const target = document.querySelector("#admin-body");
  async function render() {
    document
      .querySelectorAll("[data-section]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.section === section),
      );
    switch (section) {
      case "testnet": {
        const state = await api("/admin/testnet");
        target.innerHTML = `<section class="panel"><h2>Binance Testnet</h2>${notice(t("testnetInfo"), "warn")}${!state.configured ? notice(t("testnetMissing"), "warn") : ""}<form id="testnet-form">${field("symbol", "asset", "text", 'value="BTCUSDT" pattern="[A-Z]+USDT"')}<label>${t("action")}<select name="side"><option value="BUY">${t("buy")}</option><option value="SELL">${t("sell")}</option></select></label><label>${t("action")}<select name="type"><option value="LIMIT">${t("limit")}</option><option value="MARKET">${t("market")}</option></select></label>${field("quantity", "quantity", "text", 'inputmode="decimal"')}${field("price", "price", "text", 'inputmode="decimal"')}<div data-result></div><button class="btn primary" ${!state.configured ? "disabled" : ""}>${t("review")}</button></form></section><section class="panel"><h3>${t("orders")}</h3>${table(
          [t("asset"), t("quantity"), t("status"), t("action")],
          state.items.map(
            (j) =>
              `<tr><td>${esc(j.symbol)}</td><td>${money(j.filled, 8)} / ${money(j.quantity, 8)}</td><td>${t({ queued: "queued", unknown: "uncertain", accepted: "accepted", review: "needsReview", terminal: "completed" }[j.state] || "status")}<div class="hint">${esc(j.last_error || "")}</div></td><td>${["queued", "accepted", "unknown"].includes(j.state) ? `<button class="btn small outline" data-testnet-cancel="${esc(j.order_id)}">${t("cancel")}</button>` : "—"}</td></tr>`,
          ),
        )}</section>`;
        let key = requestKey();
        onForm("#testnet-form", async (b, f) => {
          if (
            !(await confirmAction(
              `${t("testnetInfo")}<p>${esc(b.side)} ${esc(b.symbol)} · ${esc(b.quantity)} · ${esc(b.price)} USDT</p>`,
            ))
          )
            return;
          await api("/admin/testnet/orders", {
            method: "POST",
            body: b,
            headers: { "Idempotency-Key": key },
          });
          key = requestKey();
          f.querySelector("[data-result]").innerHTML = notice(
            t("testnetQueued"),
            "success",
          );
        });
        document.querySelectorAll("[data-testnet-cancel]").forEach(
          (b) =>
            (b.onclick = async () => {
              try {
                await api("/orders/" + b.dataset.testnetCancel, {
                  method: "DELETE",
                });
                toast(t("cancelRequested"));
                await render();
              } catch (e) {
                toast(e.message, true);
              }
            }),
        );
        break;
      }
      case "user":
        target.innerHTML = `<section class="panel"><h2>${t("user")}</h2><form id="user-search"><label>${t("userSearch")}<input name="q" type="search"></label><button class="btn primary">${t("search")}</button><div data-result></div></form><div id="users"></div></section><section class="panel"><h3>${t("adjustment")}</h3>${notice(t("manual"), "warn")}<form id="adjust-form">${field("user", "user", "text", 'placeholder="User UUID"')}<label>${t("asset")}<select name="asset"><option>USDT</option><option>BTC</option><option>ETH</option></select></label>${field("amount", "amount", "text", 'inputmode="decimal"')}${field("reason", "reason", "text", 'minlength="8" maxlength="500"')}<div data-result></div><button class="btn primary">${t("save")}</button></form></section>`;
        onForm("#user-search", async (b) => {
          const r = await api("/admin/users?q=" + encodeURIComponent(b.q));
          document.querySelector("#users").innerHTML = table(
            ["UID", t("email"), t("user")],
            r.items.map(
              (u) =>
                `<tr><td>${esc(u.uid)}</td><td>${esc(u.email)}</td><td><button class="btn small outline" data-user="${esc(u.id)}">${t("choose")}</button></td></tr>`,
            ),
          );
          document.querySelectorAll("[data-user]").forEach(
            (b) =>
              (b.onclick = () => {
                document.querySelector("#adjust-form").elements.user.value =
                  b.dataset.user;
              }),
          );
        });
        let adjustmentKey = requestKey();
        onForm("#adjust-form", async (b, f) => {
          await api("/admin/adjustments", {
            method: "POST",
            body: b,
            headers: { "Idempotency-Key": adjustmentKey },
          });
          adjustmentKey = requestKey();
          f.querySelector("[data-result]").innerHTML = notice(
            t("saved"),
            "success",
          );
        });
        break;
      case "deposit":
        await (await import("./deposits.js")).renderDepositAdmin(target);
        break;
      case "withdraw":
        target.innerHTML = `<div class="panel"><h2>${t("withdraw")}</h2>${notice(t("custodyMissing"), "warn")}${table(
          [t("user"), t("amount"), t("address"), t("status"), t("action")],
          overview.withdrawals.map(
            (w) =>
              `<tr><td>${esc(w.user_id)}</td><td>${money(w.amount, 8)} ${esc(w.asset)}</td><td>${esc(w.address)}</td><td>${esc(w.status)}</td><td>${w.status === "awaiting_review" ? `<button class="btn small danger" data-reject="${esc(w.id)}">${t("reject")}</button>` : "—"}</td></tr>`,
          ),
        )}</div>`;
        document.querySelectorAll("[data-reject]").forEach(
          (b) =>
            (b.onclick = async () => {
              try {
                await api(
                  "/admin/withdrawals/" + b.dataset.reject + "/review",
                  { method: "POST", body: { approve: false } },
                );
                toast(t("saved"));
                await renderAdmin({ standard, date });
              } catch (e) {
                toast(e.message, true);
              }
            }),
        );
        break;
      case "orders":
        target.innerHTML = `<section class="panel"><h2>${t("orders")}</h2>${notice(t("simulationOrder"), "warn")}${table(
          ["ID", t("asset"), t("quantity"), t("status")],
          overview.orders.map(
            (o) =>
              `<tr><td><button class="btn small outline" data-order="${esc(o.id)}">${esc(o.id.slice(0, 8))}</button></td><td>${esc(o.symbol)}</td><td>${money(o.quantity, 8)}</td><td>${esc(o.status)}</td></tr>`,
          ),
        )}<form id="simulate-form">${field("id", "orders")}${field("quantity", "quantity", "text", 'inputmode="decimal"')}${field("price", "price", "text", 'inputmode="decimal"')}<div data-result></div><button class="btn primary">${t("simulate")}</button></form></section>`;
        document
          .querySelectorAll("[data-order]")
          .forEach(
            (b) =>
              (b.onclick = () =>
                (document.querySelector("#simulate-form").elements.id.value =
                  b.dataset.order)),
          );
        let fillKey = requestKey();
        onForm("#simulate-form", async (b, f) => {
          await api(
            "/admin/orders/" + encodeURIComponent(b.id) + "/simulate-fill",
            {
              method: "POST",
              body: b,
              headers: { "Idempotency-Key": fillKey },
            },
          );
          fillKey = requestKey();
          f.querySelector("[data-result]").innerHTML = notice(
            t("saved"),
            "success",
          );
        });
        break;
      case "tickets":
        target.innerHTML = `<section class="panel"><h2>${t("tickets")}</h2>${overview.tickets.length ? overview.tickets.map((x) => `<article><h3>${esc(x.subject)}</h3><span class="badge">${t({ account: "accountCategory", google: "googleCategory", deposit: "deposit", withdraw: "withdraw", trade: "trade", security: "security" }[x.category] || "accountCategory")}</span><p class="hint">#${esc(x.id)}</p><p class="hint">${esc(x.user_id)}</p><p>${esc(x.message)}</p><p class="hint">${esc(x.reply || "")}</p><form data-ticket="${esc(x.id)}"><label>${t("reply")}<textarea name="reply" required minlength="3" maxlength="5000"></textarea></label><button class="btn primary">${t("send")}</button><div data-result></div></form><div class="divider"></div></article>`).join("") : empty()}</section>`;
        document.querySelectorAll("[data-ticket]").forEach((f, i) => {
          f.id = "ticket-" + i;
          onForm("#" + f.id, async (b) => {
            await api("/admin/tickets/" + f.dataset.ticket, {
              method: "PATCH",
              body: b,
            });
            toast(t("saved"));
          });
        });
        break;
      case "promotions":
        target.innerHTML = `<section class="panel"><h2>${t("promotions")}</h2>${notice(t("activationBlocked"), "warn")}${overview.campaigns.map((c, i) => `<form id="campaign-${i}" data-campaign="${esc(c.id)}"><label>${t("editor")}<textarea name="json" rows="20" required>${esc(JSON.stringify(c, null, 2))}</textarea></label><button class="btn primary">${t("save")}</button><div data-result></div></form>`).join("")}</section>`;
        document.querySelectorAll("[data-campaign]").forEach((f) =>
          onForm("#" + f.id, async (b) => {
            let value;
            try {
              value = JSON.parse(b.json);
            } catch {
              throw Error(t("invalidForm"));
            }
            await api("/admin/campaigns/" + f.dataset.campaign, {
              method: "PUT",
              body: value,
            });
            toast(t("saved"));
          }),
        );
        break;
      case "audit":
        target.innerHTML = `<section class="panel"><h2>${t("audit")}</h2>${table(
          [
            t("date"),
            t("user"),
            t("admin"),
            t("reason"),
            t("asset"),
            t("amount"),
            t("before"),
            t("after"),
          ],
          overview.audit.map(
            (a) =>
              `<tr><td>${date(a.created_at)}</td><td>${esc(a.user_id)}</td><td>${esc(a.actor || "—")}</td><td>${esc(a.reason || a.kind)}</td><td>${esc(a.asset)}</td><td>${money(a.amount, 8)}</td><td>${money(a.before_balance, 8)}</td><td>${money(a.after_balance, 8)}</td></tr>`,
          ),
        )}</section>`;
        break;
    }
  }
  document.querySelectorAll("[data-section]").forEach(
    (b) =>
      (b.onclick = () => {
        section = b.dataset.section;
        render();
      }),
  );
  await render();
}
