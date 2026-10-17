import { api } from "./api.js";
export async function mainAccount() {
  const r = await api("/wallet");
  const balance = (b) =>
    r.items.find((a) => a.asset === "USDT" && a.bucket === b)?.balance || "0";
  return {
    available: balance("available"),
    reserved: balance("locked"),
    bonus: balance("bonus"),
    currency: "USDT",
    virtual: false,
  };
}
