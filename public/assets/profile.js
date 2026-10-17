import { api, me, escape as esc, money, onForm, notice, toast } from "./api.js";
import { t, languages, lang, setLanguage } from "./i18n.js";
import { icon } from "./icons.js";
const copy = {
  az: [
    "Hesab mərkəzi",
    "Şəxsi məlumatlar",
    "Görünən ad",
    "USDT balansı",
    "Balansı gizlət / göstər",
    "Hesabına nəzarət səndədir",
    "Vəsaitlərini və əmrlərini bir yerdən idarə et.",
    "Hesabın qorunması",
    "E-poçt təsdiqi",
    "İki mərhələli doğrulama",
    "Son hərəkətlər",
    "Bütün tarixçə",
    "Hazırda bonus yoxdur.",
    "Girişlər və cihazlar",
    "Depozit ünvanları və köçürmələr",
    "Açıq və tamamlanmış əmrlər",
    "Aktiv kampaniyalar və şərtlər",
    "Sual və müraciətlər",
    "Hesab məlumatları yadda saxlanıldı.",
  ],
  en: [
    "Account centre",
    "Personal details",
    "Display name",
    "USDT balance",
    "Hide / show balance",
    "Your account, in your control",
    "Manage your funds and orders in one place.",
    "Account protection",
    "Email verification",
    "Two-step verification",
    "Recent activity",
    "Full history",
    "No bonuses currently.",
    "Sign-ins and devices",
    "Deposit addresses and transfers",
    "Open and completed orders",
    "Available campaigns and terms",
    "Questions and requests",
    "Account details saved.",
  ],
  tr: [
    "Hesap merkezi",
    "Kişisel bilgiler",
    "Görünen ad",
    "USDT bakiyesi",
    "Bakiyeyi gizle / göster",
    "Hesabının kontrolü sende",
    "Varlıklarını ve emirlerini tek yerden yönet.",
    "Hesap koruması",
    "E-posta doğrulaması",
    "İki aşamalı doğrulama",
    "Son hareketler",
    "Tüm geçmiş",
    "Şu anda bonus yok.",
    "Girişler ve cihazlar",
    "Yatırma adresleri ve transferler",
    "Açık ve tamamlanan emirler",
    "Kampanyalar ve koşullar",
    "Sorular ve talepler",
    "Hesap bilgileri kaydedildi.",
  ],
  ru: [
    "Центр аккаунта",
    "Личные данные",
    "Отображаемое имя",
    "Баланс USDT",
    "Скрыть / показать баланс",
    "Ваш аккаунт под вашим контролем",
    "Управляйте средствами и ордерами в одном месте.",
    "Защита аккаунта",
    "Подтверждение почты",
    "Двухэтапная проверка",
    "Последние операции",
    "Вся история",
    "Бонусов пока нет.",
    "Входы и устройства",
    "Адреса и переводы",
    "Открытые и исполненные ордера",
    "Акции и условия",
    "Вопросы и обращения",
    "Данные аккаунта сохранены.",
  ],
};
const c = (i) => (copy[lang] || copy.az)[i];
const row = (key, desc, glyph = key) =>
  `<a class="profile-row" href="/${key}.html"><span class="profile-row-icon">${icon(glyph)}</span><span><strong>${t(key)}</strong><small>${esc(desc)}</small></span>${icon("arrow")}</a>`;
export async function renderProfile(standard) {
  const [wallet, history] = await Promise.all([
    api("/demo/account"),
    api("/demo/ledger"),
  ]);
  const balance = (b) =>
    b === "available"
      ? wallet.available
      : b === "locked"
        ? wallet.reserved
        : "0.00";
  const name = me.user.display_name || me.user.email.split("@")[0];
  standard(
    `<div class="account-workspace"><section class="profile-sheet"><div class="profile-sheet-heading"><span>${t("profile")}</span><a class="profile-close" href="/index.html" aria-label="${t("home")}">×</a></div><div class="profile-identity"><div class="profile-avatar">${esc(Array.from(name)[0]?.toUpperCase() || "O")}</div><h2>${esc(name)}</h2><button class="profile-uid" data-copy="${esc(me.user.uid)}">${icon("copy")} ${esc(me.user.uid)}</button><p>${esc(me.user.email)}</p></div><div class="profile-balance"><div class="profile-balance-top"><span>${t("demoBalance")}</span><button class="iconbtn" id="toggle-balance" aria-label="${c(4)}">${icon("eye")}</button></div><strong class="profile-amount" data-balance="${esc(money(balance("available")))}"></strong><small>DEMO $</small><div class="profile-funds"><span>${t("locked")} <b data-balance="${esc(money(balance("locked")))}"></b></span><span>${t("bonus")} <b data-balance="${esc(money(balance("bonus")))}"></b></span></div><div class="profile-actions"><a class="btn" href="/deposit.html">${icon("deposit")}${t("deposit")}</a><a class="btn soft" href="/withdraw.html">${icon("withdraw")}${t("withdraw")}</a></div></div><div class="profile-menu-group">${row("wallet", c(14), "wallet")}${row("orders", c(15), "trade")}${row("history", c(11), "history")}</div><div class="profile-menu-group">${row("promotions", c(16), "gift")}${row("security", c(13), "shield")}${row("support", c(17), "support")}${me.user.role === "admin" ? `<a class="profile-row" href="/admin/"><span class="profile-row-icon">${icon("shield")}</span><strong>${t("admin")}</strong>${icon("arrow")}</a>` : ""}</div><button class="profile-logout" id="profile-logout">${icon("logout")}${t("logout")}</button></section><div class="profile-side"><div class="profile-welcome"><div class="eyebrow">OXION · ${c(0)}</div><h2>${c(5)}</h2><p>${c(6)}</p></div><section class="panel profile-settings"><h3>${c(1)}</h3><form id="profile-form"><label>${c(2)}<input name="display_name" maxlength="60" autocomplete="nickname" value="${esc(me.user.display_name || "")}"></label><label>${t("email")}<input type="email" readonly value="${esc(me.user.email)}"></label><label>${t("language")}<select name="language">${languages.map((v) => `<option value="${v}" ${v === lang ? "selected" : ""}>${{ az: "Azərbaycan dili", en: "English", tr: "Türkçe", ru: "Русский" }[v]}</option>`).join("")}</select></label><div data-result></div><button class="btn primary">${t("save")}</button></form></section><section class="panel profile-security"><h3>${c(7)}</h3><div class="protection-row"><span>${icon("mail")}${c(8)}</span><span class="badge ${me.user.verified ? "ok" : ""}">${t(me.user.verified ? "verified" : "unverified")}</span></div><div class="protection-row"><span>${icon("shield")}${c(9)}</span><a href="/security.html" class="text-link">${t(me.user.totp ? "enabled" : "enable2fa")}</a></div>${!me.user.verified ? `<button id="profile-resend" class="btn soft">${t("resend")}</button>` : ""}</section><section class="panel profile-activity"><div class="section-title"><h3>${c(10)}</h3><a href="/history.html" class="text-link">${t("viewAll")}</a></div>${
      history.items
        .slice(0, 3)
        .map(
          (h) =>
            `<div class="activity-row"><span class="profile-row-icon">${icon("history")}</span><span><strong>${esc(h.asset || "DEMO $")}</strong><small>${new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(h.created_at))}</small></span><b>${esc(money(h.amount, 6))}</b></div>`,
        )
        .join("") || `<p class="hint">${t("empty")}</p>`
    }</section></div></div>`,
  );
  let hidden = localStorage.getItem("oxion-hide-balance") === "true";
  const update = () => {
    document
      .querySelectorAll("[data-balance]")
      .forEach(
        (el) => (el.textContent = hidden ? "••••••" : el.dataset.balance),
      );
    document
      .querySelector("#toggle-balance")
      .setAttribute("aria-pressed", String(hidden));
  };
  update();
  document.querySelector("#toggle-balance").onclick = () => {
    hidden = !hidden;
    localStorage.setItem("oxion-hide-balance", String(hidden));
    update();
  };
  onForm("#profile-form", async (b, f) => {
    await api("/profile", { method: "PATCH", body: b });
    if (b.language !== lang) setLanguage(b.language);
    else {
      f.querySelector("[data-result]").innerHTML = notice(c(18), "success");
      me.user.display_name = b.display_name.trim();
      const name = me.user.display_name || me.user.email.split("@")[0];
      document.querySelector(".profile-identity h2").textContent = name;
      document.querySelector(".profile-avatar").textContent =
        Array.from(name)[0]?.toUpperCase() || "O";
    }
  });
  document.querySelector("#profile-logout").onclick = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      location.assign("/login.html");
    } catch (e) {
      toast(e.message, true);
    }
  };
  document
    .querySelector("#profile-resend")
    ?.addEventListener("click", async () => {
      try {
        const r = await api("/auth/resend", { method: "POST" });
        toast(t(r.delivery === "smtp" ? "checkEmail" : "smtpMissing"));
      } catch (e) {
        toast(e.message, true);
      }
    });
}
