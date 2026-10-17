export const depositCatalog = [
  ["usdt-bep20", "USDT", "BEP20", "BNB Smart Chain", 15, "evm"],
  ["usdt-trc20", "USDT", "TRC20", "TRON", 20, "tron"],
  ["usdt-erc20", "USDT", "ERC20", "Ethereum", 12, "evm"],
  ["btc", "BTC", "BTC", "Bitcoin", 3, "btc"],
  ["eth", "ETH", "ERC20", "Ethereum", 12, "evm"],
  ["bnb", "BNB", "BEP20", "BNB Smart Chain", 15, "evm"],
  ["sol", "SOL", "SOL", "Solana", 32, "sol"],
  ["xrp", "XRP", "XRP", "XRP Ledger", 1, "xrp"],
  ["doge", "DOGE", "DOGE", "Dogecoin", 20, "doge"],
  ["ada", "ADA", "ADA", "Cardano", 15, "ada"],
  ["trx", "TRX", "TRC20", "TRON", 20, "tron"],
  ["avax", "AVAX", "AVAX-C", "Avalanche C-Chain", 12, "evm"],
  ["link", "LINK", "ERC20", "Ethereum", 12, "evm"],
  ["ltc", "LTC", "LTC", "Litecoin", 6, "ltc"],
  ["bch", "BCH", "BCH", "Bitcoin Cash", 6, "bch"],
].map(([id, asset, network, label, confirmations, format]) => ({
  id,
  asset,
  network,
  label,
  confirmations,
  format,
}));
export const depositPreset = (asset, network) =>
  depositCatalog.find((p) => p.asset === asset && p.network === network);
