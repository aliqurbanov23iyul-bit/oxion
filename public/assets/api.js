import { icon } from "./icons.js";
import { errorText, t } from "./i18n.js";
export let me = { user: null };
export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function api(path, options = {}) {
  let r;
  try {
    r = await fetch("/api" + path, {
      ...options,
      credentials: "same-origin",
      signal: options.signal || AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        ...(me.csrf ? { "X-CSRF-Token": me.csrf } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw Object.assign(Error(errorText("CONNECTION")), { code: "CONNECTION" });
  }
  const data = await r.json().catch(() => ({ error: "INTERNAL_ERROR" }));
  if (!r.ok)
    throw Object.assign(Error(errorText(data.error)), { code: data.error });
  return data;
}
export async function loadMe() {
  me = await api("/me");
  return me;
}
export const requestKey = () => crypto.randomUUID();
export function toast(text, error = false) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast" + (error ? " error" : "");
  el.setAttribute("role", error ? "alert" : "status");
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 7000);
}
export function notice(text, type = "") {
  return `<div class="notice ${type}" role="status">${escape(text)}</div>`;
}
export function empty() {
  return `<div class="empty"><div class="empty-icon">${icon("history")}</div><strong>${t("empty")}</strong><br>${t("emptyDesc")}</div>`;
}
export const money = (value, digits = 2) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat(
        { az: "az-AZ", en: "en-US", tr: "tr-TR", ru: "ru-RU" }[
          document.documentElement.lang
        ] || "en-US",
        { maximumFractionDigits: digits, minimumFractionDigits: digits },
      ).format(value);
export function table(headers, rows) {
  return rows.length
    ? `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
    : empty();
}
export function field(name, label, type = "text", extra = "") {
  return `<label>${t(label)}<input name="${name}" type="${type}" ${extra} required></label>`;
}
export function onForm(selector, fn) {
  const form = document.querySelector(selector);
  if (!form) return;
  form.noValidate = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.pending === "true") return;
    const output = form.querySelector("[data-result]");
    if (output) output.innerHTML = "";
    form
      .querySelectorAll("input,select,textarea")
      .forEach((input) => input.setCustomValidity(""));
    if (!form.checkValidity()) {
      const invalid = form.querySelector(":invalid");
      const key =
        invalid?.name === "terms"
          ? "termsRequired"
          : invalid?.validity.valueMissing
            ? "fieldRequired"
            : invalid?.validity.typeMismatch
              ? "invalidEmail"
              : invalid?.name === "password" && invalid.validity.tooShort
                ? "passwordLength"
                : invalid?.inputMode === "decimal"
                  ? "invalidAmount"
                  : "invalidForm";
      const label = invalid?.labels?.[0]?.firstChild?.textContent.trim();
      const message = (label ? label + ": " : "") + t(key);
      if (output) output.innerHTML = notice(message, "error");
      else toast(message, true);
      invalid?.focus();
      return;
    }
    const button =
      e.submitter ||
      form.querySelector('button[type="submit"],button:not([type])');
    if (button) button.disabled = true;
    const buttonContent = button?.innerHTML;
    if (button) button.textContent = t("waiting");
    form.dataset.pending = "true";
    form.setAttribute("aria-busy", "true");
    try {
      await fn(Object.fromEntries(new FormData(form)), form);
    } catch (error) {
      if (output) output.innerHTML = notice(error.message, "error");
      else toast(error.message, true);
    } finally {
      if (button) button.disabled = false;
      if (button) button.innerHTML = buttonContent;
      delete form.dataset.pending;
      form.removeAttribute("aria-busy");
    }
  });
}
export async function confirmAction(content) {
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `<h2>${t("review")}</h2><div class="hint">${content}</div><div class="form-inline dialog-actions"><button class="btn primary" data-ok>${t("confirm")}</button><button class="btn outline" data-cancel>${t("cancel")}</button></div>`;
  document.body.append(dialog);
  dialog.showModal();
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.querySelector("[data-ok]").onclick = () => done(true);
    dialog.querySelector("[data-cancel]").onclick = () => done(false);
    dialog.oncancel = (e) => {
      e.preventDefault();
      done(false);
    };
  });
}
