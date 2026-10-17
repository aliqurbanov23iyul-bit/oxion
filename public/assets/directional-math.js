export function previewReturn(value, payout = "87") {
  if (
    !/^\d{1,8}(\.\d{1,2})?$/.test(String(value)) ||
    !/^\d{1,3}(\.\d{1,2})?$/.test(String(payout))
  )
    return null;
  const fixed = (v) => {
    const [a, b = ""] = String(v).split(".");
    return BigInt(a) * 100n + BigInt((b + "00").slice(0, 2));
  };
  const stake = fixed(value),
    percent = fixed(payout);
  if (stake <= 0n || percent > 10000n) return null;
  const gain = (stake * percent) / 10000n,
    format = (n) =>
      (n / 100n).toString() + "." + (n % 100n).toString().padStart(2, "0");
  return {
    stake: format(stake),
    profit: format(gain),
    credit: format(stake + gain),
  };
}
