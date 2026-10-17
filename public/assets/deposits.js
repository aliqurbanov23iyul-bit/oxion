import { api, escape as esc, onForm, notice, table, toast } from "./api.js";
import { t } from "./i18n.js";
import { depositCatalog } from "./deposit-catalog.js";
import { assetLogo } from "./asset-logos.js";
const texts = {
  az: [
    "Aktiv və şəbəkə seçin",
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
    "Depozit admin yoxlamasından sonra balansa əlavə olunur.",
    "Ünvan dəyişdikdə yeni üsul əlavə edin və köhnəni deaktiv edin.",
    "Minimum: 10 USDT dəyəri (təxminən 10 ABŞ dolları)",
    "QR şəkli (PNG/JPG, maksimum 100 KB, istəyə bağlı)",
    "Şəkil yüklənməsə QR avtomatik yaradılır. Yüklədiyiniz QR-nin ünvan və memo ilə uyğunluğunu yoxlayın.",
    "Cari qiymətlə minimum",
    "Qiymət alınmadı. Yenidən yoxlayın.",
    "Yalnız seçilən şəbəkədən göndərin. Şəbəkə komissiyası ayrıca ödənilir.",
  ],
  en: [
    "Select asset and network",
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
    "To change an address, add a new method and disable the old one.",
    "Minimum: 10 USDT equivalent (approximately 10 USD)",
    "QR image (PNG/JPG, maximum 100 KB, optional)",
    "A QR is generated automatically unless uploaded. Check that your uploaded QR matches the address and memo.",
    "Minimum at current price",
    "Price unavailable. Please retry.",
    "Only send on the selected network. Network fees are paid separately.",
  ],
  tr: [
    "Varlık ve ağ seçin",
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
    "Adresi değiştirmek için yeni yöntem ekleyin ve eskisini kapatın.",
    "Minimum: 10 USDT karşılığı (yaklaşık 10 USD)",
    "QR resmi (PNG/JPG, en fazla 100 KB, isteğe bağlı)",
    "Yüklemezseniz QR otomatik oluşturulur. Yüklenen QR adresini ve memosunu kontrol edin.",
    "Güncel fiyatla minimum",
    "Fiyat alınamadı. Tekrar deneyin.",
    "Yalnızca seçilen ağı kullanın. Ağ ücreti ayrıca ödenir.",
  ],
  ru: [
    "Выберите актив и сеть",
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
    "Для смены адреса добавьте новый способ и отключите старый.",
    "Минимум: эквивалент 10 USDT (примерно 10 USD)",
    "QR изображение (PNG/JPG, максимум 100 КБ, необязательно)",
    "Без загрузки QR создаётся автоматически. Проверьте соответствие QR адресу и memo.",
    "Минимум по текущей цене",
    "Цена недоступна. Повторите попытку.",
    "Используйте только выбранную сеть. Комиссия сети оплачивается отдельно.",
  ],
};
const l = (i) => (texts[document.documentElement.lang] || texts.az)[i];
const input = (name, label, extra = "") =>
  `<label>${esc(label)}<input name="${name}" required ${extra}></label>`;
const status = (s) =>
  s === "awaiting_review"
    ? l(6)
    : t(s === "confirmed" ? "completed" : "rejected");
const cards = (items, selected, attr) =>
  `<div class="deposit-options">${items.map((m) => `<button type="button" class="deposit-option ${m.id === selected ? "selected" : ""}" ${attr}="${esc(m.id)}" aria-pressed="${m.id === selected}">${assetLogo(m.asset)}<span><strong>${esc(m.asset)}</strong><small>${esc(m.network)}</small></span></button>`).join("")}</div>`;
export async function renderDeposits(standard) {
  const [methods, history] = await Promise.all([
    api("/deposit/methods"),
    api("/deposit/requests"),
  ]);
  const assets = [...new Set(methods.items.map((m) => m.asset))];
  standard(
    `<div class="transfer-layout"><section class="transfer-sheet"><div class="profile-sheet-heading"><span>${t("deposit")}</span><a class="profile-close" href="/profile.html" aria-label="${t("profile")}">×</a></div><div class="crypto-rail"><span>${assetLogo("BTC")}${t("cryptoOnly")}</span></div><div class="transfer-select"><span id="selected-asset-icon">${assetLogo(assets[0] || "USDT")}</span><label class="hidden" for="deposit-asset">${t("asset")}</label><select id="deposit-asset" aria-label="${t("asset")}" ${assets.length ? "" : "disabled"}>${assets.length ? assets.map((a) => `<option>${esc(a)}</option>`).join("") : "<option>USDT</option>"}</select></div><div class="transfer-select"><label class="hidden" for="deposit-method">${t("network")}</label><select id="deposit-method" aria-label="${t("network")}" ${assets.length ? "" : "disabled"}><option>—</option></select></div><div class="transfer-minimum"><strong>${l(14)}</strong><p id="deposit-minimum" role="status">${methods.items.length ? t("loading") : l(7)}</p></div><div id="deposit-address">${notice(l(7))}</div>${methods.items.length ? `<details class="transfer-report"><summary>${l(4)}</summary><form id="report-deposit">${input("amount", t("amount"), 'inputmode="decimal"')}${input("txid", "TXID", 'maxlength="90"')}<div data-result></div><button class="btn primary">${l(5)}</button></form></details>` : ""}<div class="transfer-links"><a href="/wallet.html">${t("wallet")}</a><a href="/support.html">${t("support")}</a></div></section><aside class="transfer-aside"><section class="panel"><h3>${t("deposit")}</h3><p class="hint">${l(12)}</p>${notice(l(19), "warn")}</section><section class="panel"><div class="section-title"><h3>${t("history")}</h3><a class="text-link" href="/history.html">${t("viewAll")}</a></div>${table(
      [t("asset"), t("amount"), t("status")],
      history.items.map(
        (d) =>
          `<tr><td>${esc(d.asset)}<small class="coin-sub">${esc(d.network)}</small></td><td>${esc(d.amount)}</td><td>${esc(status(d.status))}</td></tr>`,
      ),
    )}</section></aside></div>`,
  );
  if (!methods.items.length) return;
  const asset = document.querySelector("#deposit-asset"),
    select = document.querySelector("#deposit-method");
  let revision = 0;
  const update = async () => {
    const current = ++revision,
      m = methods.items.find((m) => m.id === select.value);
    if (!m) return;
    document.querySelector("#selected-asset-icon").innerHTML = assetLogo(
      m.asset,
    );
    document.querySelector("#deposit-minimum").textContent = t("loading");
    document.querySelector("#deposit-address").innerHTML =
      `<div class="transfer-address-card"><img src="/api/deposit/methods/${encodeURIComponent(m.id)}/qr" width="144" height="144" alt="QR"><div class="transfer-address-detail"><h3>${t("address")}</h3><code>${esc(m.address)}</code><button type="button" class="btn primary" data-copy="${esc(m.address)}">${t("copy")}</button></div></div><div class="transfer-network-details"><span>${t("confirmations")}: <b>${esc(m.confirmations)}</b></span>${m.memo ? `<span>${t("memo")}: <b>${esc(m.memo)}</b><button class="iconbtn" data-copy="${esc(m.memo)}" aria-label="${t("copy")}">⧉</button></span>` : ""}</div>`;
    try {
      const q = await api(
        "/deposit/methods/" + encodeURIComponent(m.id) + "/minimum",
      );
      if (current === revision)
        document.querySelector("#deposit-minimum").textContent =
          l(17) +
          ": " +
          q.minimum_amount.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1") +
          " " +
          q.asset;
    } catch {
      if (current === revision)
        document.querySelector("#deposit-minimum").textContent = l(18);
    }
  };
  const options = () => {
    select.innerHTML = methods.items
      .filter((m) => m.asset === asset.value)
      .map((m) => {
        const preset = depositCatalog.find(
          (p) => p.asset === m.asset && p.network === m.network,
        );
        return `<option value="${esc(m.id)}">${esc(preset?.label || m.network)} (${esc(m.network)}) · …${esc(m.address.slice(-4))}</option>`;
      })
      .join("");
    update();
  };
  asset.onchange = options;
  select.onchange = update;
  options();
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
  target.innerHTML = `<section class="panel"><h2>${l(1)}</h2>${notice(l(13))}<h3>${l(0)}</h3>${cards(depositCatalog, depositCatalog[0].id, "data-preset")}<form id="method-form"><p id="selected-preset">USDT · BEP20 · BNB Smart Chain</p><input type="hidden" name="asset" value="USDT"><input type="hidden" name="network" value="BEP20">${input("address", t("address"), 'maxlength="150"')}<label>${t("memo")}<input name="memo" maxlength="120" inputmode="numeric"></label><p><strong>${l(14)}</strong></p><label>${l(15)}<input type="file" id="qr-upload" accept="image/png,image/jpeg"></label><p class="hint">${l(16)}</p><img id="qr-preview" width="160" height="160" alt="QR" hidden>${input("confirmations", t("confirmations"), 'type="number" min="1" max="10000" value="15"')}<label><input type="checkbox" name="active"> ${l(2)}</label><div data-result></div><button class="btn primary">${t("save")}</button></form></section><section class="panel">${table(
    [t("asset"), t("network"), t("address"), t("action")],
    methods.items.map(
      (m) =>
        `<tr><td><span class="coin-name">${assetLogo(m.asset)} ${esc(m.asset)}</span></td><td>${esc(m.network)}</td><td style="overflow-wrap:anywhere">${esc(m.address)}</td><td><button class="btn small outline" data-toggle="${esc(m.id)}">${m.active ? l(3) : l(2)}</button></td></tr>`,
    ),
  )}</section><section class="panel"><h2>${t("deposit")}</h2>${requests.items.map((r) => `<article class="panel"><p>${esc(r.uid)} · ${esc(r.email)}</p><p>${esc(r.amount)} ${esc(r.asset)} · ${esc(r.network)}</p><p style="overflow-wrap:anywhere">${t("address")}: ${esc(r.address)}<br>TXID: ${esc(r.txid)}</p><p>${esc(status(r.status))}</p>${r.status === "awaiting_review" ? `<form data-review="${esc(r.id)}">${input("reason", l(8), 'minlength="8" maxlength="500"')}<label><input type="checkbox" name="verified"> ${l(9)}</label><label>${t("action")}<select name="decision"><option value="reject">${l(11)}</option><option value="approve">${l(10)}</option></select></label><div data-result></div><button class="btn primary">${t("save")}</button></form>` : ""}</article>`).join("") || notice(t("empty"))}</section>`;
  const form = target.querySelector("#method-form");
  let image = null,
    reading = false;
  target.querySelectorAll("[data-preset]").forEach(
    (btn) =>
      (btn.onclick = () => {
        const preset = depositCatalog.find((p) => p.id === btn.dataset.preset);
        form.elements.asset.value = preset.asset;
        form.elements.network.value = preset.network;
        form.elements.confirmations.value = preset.confirmations;
        form.elements.address.value = "";
        form.elements.memo.value = "";
        image = null;
        form.querySelector("#qr-upload").value = "";
        form.querySelector("#qr-preview").hidden = true;
        form.querySelector("#selected-preset").textContent =
          preset.asset + " · " + preset.network + " · " + preset.label;
        target.querySelectorAll("[data-preset]").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("selected", active);
          b.setAttribute("aria-pressed", String(active));
        });
      }),
  );
  form.querySelector("#qr-upload").onchange = async (e) => {
    image = null;
    const preview = form.querySelector("#qr-preview");
    preview.hidden = true;
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 100000
    ) {
      e.target.value = "";
      toast(l(15), true);
      return;
    }
    reading = true;
    try {
      image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      preview.src = image;
      preview.hidden = false;
    } finally {
      reading = false;
    }
  };
  onForm("#method-form", async (b, f) => {
    if (reading) throw Error(t("loading"));
    await api("/admin/deposit-methods", {
      method: "POST",
      body: { ...b, qr_image: image, active: f.elements.active.checked },
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
