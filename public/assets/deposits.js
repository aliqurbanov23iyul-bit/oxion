import { api, escape as esc, onForm, notice, table, toast } from "./api.js";
import { t } from "./i18n.js";
const labels = {
  az: [
    "Depozit üsulu",
    "Ünvan əlavə et",
    "Aktiv et",
    "Deaktiv et",
    "Depoziti bildirin",
    "Sorğunu göndər",
    "Admin yoxlaması gözlənilir.",
    "Aktiv depozit üsulu yoxdur.",
    "Səbəb / yoxlama qeydi",
    "Blokçeyndə aktiv, şəbəkə, ünvan, məbləğ və tələb olunan təsdiqləri yoxladım.",
    "Təsdiqlə",
    "Rədd et",
    "Depozit admin tərəfindən yoxlandıqdan sonra balansa əlavə olunur.",
    "Ünvan dəyişdikdə yeni üsul əlavə edin. Köhnə üsulu deaktiv edə bilərsiniz.",
  ],
  en: [
    "Deposit method",
    "Add address",
    "Enable",
    "Disable",
    "Report deposit",
    "Submit request",
    "Awaiting administrator review.",
    "No active deposit methods.",
    "Reason / verification note",
    "I checked the asset, network, address, amount and required confirmations on the blockchain.",
    "Approve",
    "Reject",
    "Deposits are credited after administrator review.",
    "Add a new method to change an address. You can disable the old method.",
  ],
  tr: [
    "Yatırma yöntemi",
    "Adres ekle",
    "Etkinleştir",
    "Devre dışı bırak",
    "Yatırmayı bildir",
    "Talep gönder",
    "Yönetici incelemesi bekleniyor.",
    "Aktif yatırma yöntemi yok.",
    "Gerekçe / kontrol notu",
    "Varlık, ağ, adres, tutar ve gerekli onayları blokzincirde kontrol ettim.",
    "Onayla",
    "Reddet",
    "Yatırmalar yönetici kontrolünden sonra bakiyeye eklenir.",
    "Adresi değiştirmek için yeni yöntem ekleyin. Eski yöntemi kapatabilirsiniz.",
  ],
  ru: [
    "Способ пополнения",
    "Добавить адрес",
    "Включить",
    "Отключить",
    "Сообщить о переводе",
    "Отправить заявку",
    "Ожидается проверка администратора.",
    "Нет доступных способов пополнения.",
    "Причина / запись проверки",
    "Я проверил актив, сеть, адрес, сумму и необходимые подтверждения в блокчейне.",
    "Подтвердить",
    "Отклонить",
    "Средства зачисляются после проверки администратором.",
    "Для смены адреса добавьте новый способ. Старый можно отключить.",
  ],
};
const statusText = s => s === 'awaiting_review' ? l(6) : s === 'confirmed' ? t('completed') : t('rejected');
const l = (i) => (labels[document.documentElement.lang] || labels.az)[i];
const input = (name, label, extra = "") =>
  `<label>${esc(label)}<input name="${name}" required ${extra}></label>`;
export async function renderDeposits(standard) {
  const [methods, history] = await Promise.all([
    api("/deposit/methods"),
    api("/deposit/requests"),
  ]);
  standard(
    `<div class="grid2"><section class="panel"><h2>${t("deposit")}</h2>${notice(l(12))}${methods.items.length ? `<label>${l(0)}<select id="deposit-method">${methods.items.map((m) => `<option value="${esc(m.id)}">${esc(m.asset)} · ${esc(m.network)}</option>`).join("")}</select></label><div id="deposit-address"></div>` : notice(l(7))}</section><section class="panel"><h2>${l(4)}</h2>${methods.items.length ? `<form id="report-deposit">${input("amount", t("amount"), 'inputmode="decimal"')}${input("txid", "TXID", 'maxlength="66"')}<div data-result></div><button class="btn primary">${l(5)}</button></form>` : notice(l(7))}</section></div><section class="panel" style="margin-top:24px"><h2>${t("history")}</h2>${table(
      [t("asset"), t("amount"), "TXID", t("status")],
      history.items.map(
        (d) =>
          `<tr><td>${esc(d.asset)} · ${esc(d.network)}</td><td>${esc(d.amount)}</td><td style="overflow-wrap:anywhere">${esc(d.txid)}</td><td>${esc(statusText(d.status))}<div>${esc(d.reason || "")}</div></td></tr>`,
      ),
    )}</section>`,
  );
  if (!methods.items.length) return;
  const select = document.querySelector("#deposit-method");
  const update = () => {
    const m = methods.items.find((m) => m.id === select.value);
    document.querySelector("#deposit-address").innerHTML =
      `<img src="/api/deposit/methods/${encodeURIComponent(m.id)}/qr" width="200" height="200" alt="QR"><label>${t("address")}<input readonly value="${esc(m.address)}"></label><button class="btn small outline" data-copy="${esc(m.address)}">${t("copy")}</button><p>${t("minimum")}: ${esc(m.minimum)} ${esc(m.asset)}</p><p>${t("confirmations")}: ${esc(m.confirmations)}</p><p>${t("memo")}: ${esc(m.memo || "—")}</p>`;
  };
  select.onchange = update;
  update();
  onForm("#report-deposit", async (b, f) => {
    await api("/deposit/requests", {
      method: "POST",
      body: { ...b, method: select.value },
    });
    f.querySelector("[data-result]").innerHTML = notice(l(6), "success");
  });
}
export async function renderDepositAdmin(target) {
  const [methods, requests] = await Promise.all([
    api("/admin/deposit-methods"),
    api("/admin/deposit-requests"),
  ]);
  target.innerHTML = `<section class="panel"><h2>${l(1)}</h2>${notice(l(13))}<form id="method-form">${input("asset", t("asset"), 'value="USDT" maxlength="10"')}${input("network", t("network"), 'value="BEP20" pattern="[A-Z0-9-]{2,30}"')}${input("address", t("address"), 'maxlength="150"')}<label>${t("memo")}<input name="memo" maxlength="120"></label>${input("minimum", t("minimum"), 'value="10" inputmode="decimal"')}${input("confirmations", t("confirmations"), 'type="number" min="1" max="10000" value="15"')}<label><input type="checkbox" name="active"> ${l(2)}</label><div data-result></div><button class="btn primary">${t("save")}</button></form></section><section class="panel">${table(
    [t("asset"), t("network"), t("address"), t("action")],
    methods.items.map(
      (m) =>
        `<tr><td>${esc(m.asset)}</td><td>${esc(m.network)}</td><td style="overflow-wrap:anywhere">${esc(m.address)}</td><td><button class="btn small outline" data-toggle="${esc(m.id)}">${m.active ? l(3) : l(2)}</button></td></tr>`,
    ),
  )}</section><section class="panel"><h2>${t("deposit")}</h2>${requests.items.map((r) => `<article class="panel"><p>${esc(r.uid)} · ${esc(r.email)}</p><p>${esc(r.amount)} ${esc(r.asset)} · ${esc(r.network)}</p><p style="overflow-wrap:anywhere">${t("address")}: ${esc(r.address)}<br>TXID: ${esc(r.txid)}</p><p>${esc(statusText(r.status))}</p>${r.status === "awaiting_review" ? `<form data-review="${esc(r.id)}">${input("reason", l(8), 'minlength="8" maxlength="500"')}<label><input type="checkbox" name="verified"> ${l(9)}</label><label>${t("action")}<select name="decision"><option value="reject">${l(11)}</option><option value="approve">${l(10)}</option></select></label><div data-result></div><button class="btn primary">${t("save")}</button></form>` : ""}</article>`).join("") || notice(t("empty"))}</section>`;
  onForm("#method-form", async (b, f) => {
    await api("/admin/deposit-methods", {
      method: "POST",
      body: { ...b, active: f.elements.active.checked },
    });
    await renderDepositAdmin(target);
  });
  target.querySelectorAll("[data-toggle]").forEach(
    (btn) =>
      (btn.onclick = async () => {
        try {
          const m = methods.items.find((m) => m.id === btn.dataset.toggle);
          await api("/admin/deposit-methods/" + m.id, {
            method: "PATCH",
            body: { active: !m.active },
          });
          await renderDepositAdmin(target);
        } catch (e) {
          toast(e.message, true);
        }
      }),
  );
  target.querySelectorAll("[data-review]").forEach((f, i) => {
    f.id = "review-" + i;
    onForm("#" + f.id, async (b) => {
      await api("/admin/deposit-requests/" + f.dataset.review + "/review", {
        method: "POST",
        body: {
          approve: b.decision === "approve",
          verified: f.elements.verified.checked,
          reason: b.reason,
        },
      });
      await renderDepositAdmin(target);
    });
  });
}
