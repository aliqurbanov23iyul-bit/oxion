import { createHmac } from "node:crypto";
import { fail } from "./core.js";
export const assets = [
  "BTC",
  "ETH",
  "BNB",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "TRX",
  "AVAX",
  "LINK",
  "DOT",
  "LTC",
  "BCH",
  "SUI",
  "TON",
];
const base = "https://data-api.binance.vision";
async function get(path, root = base) {
  try {
    const r = await fetch(root + path, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) fail(503, "MARKET_UNAVAILABLE");
    return await r.json();
  } catch (e) {
    fail(503, "MARKET_UNAVAILABLE");
  }
}
let cached, metadata, inflight;
async function catalog() {
  if (metadata && Date.now() - metadata.at < 300000) return metadata.symbols;
  const symbols = assets.map((a) => a + "USDT");
  let result;
  try {
    result = (
      await get(
        "/api/v3/exchangeInfo?showPermissionSets=false&symbols=" +
          encodeURIComponent(JSON.stringify(symbols)),
      )
    ).symbols;
  } catch {
    result = (
      await Promise.all(
        symbols.map(async (symbol) => {
          let r;
          try {
            r = await fetch(base + "/api/v3/exchangeInfo?symbol=" + symbol, {
              signal: AbortSignal.timeout(12000),
            });
            const data = await r.json();
            if (r.status === 400 && data.code === -1121) return null;
            if (!r.ok) fail(503, "MARKET_UNAVAILABLE");
            return data.symbols[0];
          } catch {
            fail(503, "MARKET_UNAVAILABLE");
          }
        }),
      )
    ).filter(Boolean);
  }
  metadata = { at: Date.now(), symbols: result };
  return result;
}
export async function markets() {
  if (cached && Date.now() - cached.at < 15000) return cached.data;
  if (inflight) return inflight;
  inflight = (async () => {
    const info = await catalog();
    const supported = info
      .filter((s) => s.status === "TRADING" && s.isSpotTradingAllowed)
      .map((s) => s.symbol);
    const tickers = supported.length
      ? await get(
          "/api/v3/ticker/24hr?symbols=" +
            encodeURIComponent(JSON.stringify(supported)),
        )
      : [];
    const data = assets.map((asset) => {
      const s = info.find(
        (s) =>
          s.symbol === asset + "USDT" &&
          s.status === "TRADING" &&
          s.isSpotTradingAllowed,
      );
      const t = tickers.find((t) => t.symbol === asset + "USDT");
      return {
        asset,
        symbol: asset + "USDT",
        supported: !!s,
        price: s && t ? t.lastPrice : null,
        change: s && t ? t.priceChangePercent : null,
        volume: s && t ? t.quoteVolume : null,
        filters: s?.filters || [],
      };
    });
    cached = { at: Date.now(), data };
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
export async function marketDetail(symbol, interval = "1h") {
  if (!(await markets()).some((m) => m.symbol === symbol && m.supported))
    fail(400, "UNSUPPORTED_PAIR");
  if (!["1m", "5m", "15m", "1h", "4h", "1d"].includes(interval))
    fail(400, "INVALID_INTERVAL");
  const [candles, book, trades] = await Promise.all([
    get(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=60`),
    get(`/api/v3/depth?symbol=${symbol}&limit=20`),
    get(`/api/v3/trades?symbol=${symbol}&limit=20`),
  ]);
  return {
    candles,
    book,
    trades,
    source: "Binance public market data",
    at: new Date().toISOString(),
  };
}
// Deliberately testnet-only. This adapter does not settle the local ledger.
export class BinanceTestnet {
  constructor(key, secret) {
    this.key = key;
    this.secret = secret;
  }
  async request(method, path, params) {
    if (!this.key || !this.secret) fail(503, "PROVIDER_NOT_CONFIGURED");
    const q = new URLSearchParams({
      ...params,
      timestamp: String(Date.now()),
      recvWindow: "5000",
    });
    q.set(
      "signature",
      createHmac("sha256", this.secret).update(q.toString()).digest("hex"),
    );
    const r = await fetch("https://testnet.binance.vision" + path + "?" + q, {
      method,
      headers: { "X-MBX-APIKEY": this.key },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    if (!r.ok)
      throw Object.assign(Error("Testnet request failed"), {
        status: 502,
        providerCode: data.code,
        definitiveRejection:
          method === "POST" &&
          r.status >= 400 &&
          r.status < 500 &&
          r.status !== 429 &&
          [-1013, -1100, -1111, -1121, -2010].includes(data.code) &&
          !/duplicate/i.test(String(data.msg)),
      });
    return data;
  }
  order(o) {
    return this.request("POST", "/api/v3/order", {
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      quantity: o.quantity,
      newClientOrderId: o.id,
      ...(o.type === "LIMIT" ? { price: o.price, timeInForce: "GTC" } : {}),
    });
  }
  status(symbol, id) {
    return this.request("GET", "/api/v3/order", {
      symbol,
      origClientOrderId: id,
    });
  }
  cancel(symbol, id) {
    return this.request("DELETE", "/api/v3/order", {
      symbol,
      origClientOrderId: id,
    });
  }
  trades(symbol, orderId) {
    return this.request("GET", "/api/v3/myTrades", {
      symbol,
      orderId: String(orderId),
      limit: "1000",
    });
  }
  async markets() {
    const info = await get(
      "/api/v3/exchangeInfo",
      "https://testnet.binance.vision",
    );
    const symbols = info.symbols.filter(
      (s) => s.quoteAsset === "USDT" && assets.includes(s.baseAsset),
    );
    const tickers = await get(
      "/api/v3/ticker/price",
      "https://testnet.binance.vision",
    );
    return symbols.map((s) => ({
      symbol: s.symbol,
      asset: s.baseAsset,
      supported: s.status === "TRADING" && s.isSpotTradingAllowed,
      price: tickers.find((t) => t.symbol === s.symbol)?.price || null,
      filters: s.filters,
    }));
  }
}
export const networks = [
  {
    asset: "USDT",
    network: "ETH-SEPOLIA",
    label: "Ethereum Sepolia · sınaq",
    minimum: "10",
    fee: "1",
    confirmations: 12,
    memo: false,
    explorer: "https://sepolia.etherscan.io/tx/",
  },
];
export function depositAddress() {
  fail(503, "CUSTODY_NOT_CONFIGURED");
}
// No invented addresses, no unverified webhook credits, no mainnet broadcast.
