const marks = {
  DOT: [
    "#e6007a",
    '<ellipse cx="20" cy="9" rx="3" ry="5"/><ellipse cx="20" cy="31" rx="3" ry="5"/><ellipse cx="10" cy="15" rx="4" ry="3"/><ellipse cx="30" cy="15" rx="4" ry="3"/><ellipse cx="10" cy="25" rx="4" ry="3"/><ellipse cx="30" cy="25" rx="4" ry="3"/>',
  ],
  SUI: [
    "#4897d4",
    '<path d="M20 6C15 14 9 20 9 25a11 11 0 0 0 22 0C31 20 25 14 20 6z" fill="none" stroke="white" stroke-width="2"/><path d="M13 24c8-5 7 8 15 2" fill="none" stroke="white" stroke-width="2"/>',
  ],
  TON: [
    "#0098ea",
    '<path d="M8 12h24L20 32zM20 12v20" fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>',
  ],

  USDT: [
    "#26a17b",
    '<path d="M10 8h20v5h-7v4c9 .3 11 2 11 3s-6 3-14 3S6 21 6 20s2-3 11-3v-4h-7zm7 12v-1c-6 .2-8 1-8 1s4 1 11 1 11-1 11-1-2-.8-8-1v1zm0 4h6v10h-6z"/>',
  ],
  BTC: [
    "#f7931a",
    '<text x="20" y="31" text-anchor="middle" font-size="30" font-family="Arial" font-weight="bold">₿</text>',
  ],
  BCH: [
    "#0ac18e",
    '<text x="20" y="31" text-anchor="middle" font-size="30" font-family="Arial" font-weight="bold">Ƀ</text>',
  ],
  ETH: ["#627eea", '<path d="m20 5-9 15 9 5 9-5zm0 22-9-5 9 13 9-13z"/>'],
  BNB: [
    "#d6a609",
    '<path d="m20 6 6 6-3 3-3-3-3 3-3-3zm-9 9 5 5-5 5-5-5zm18 0 5 5-5 5-5-5zm-9 1 4 4-4 4-4-4zm-6 12 3-3 3 3 3-3 3 3-6 6z"/>',
  ],
  SOL: [
    "#6353d6",
    '<path d="m11 10-4 5h23l4-5zm-4 8 4 5h23l-4-5zm4 8-4 5h23l4-5z"/>',
  ],
  XRP: [
    "#25344a",
    '<path d="M9 10h5l6 7 6-7h5l-8 9a4 4 0 0 1-6 0zm0 20h5l6-7 6 7h5l-8-9a4 4 0 0 0-6 0z"/>',
  ],
  TRX: [
    "#e7354e",
    '<path d="m7 7 27 5-12 22z" fill="none" stroke="white" stroke-width="2"/><path d="m7 7 18 11 9-6M25 18l-3 16" fill="none" stroke="white" stroke-width="2"/>',
  ],
  DOGE: [
    "#b99a42",
    '<text x="20" y="30" text-anchor="middle" font-size="29" font-family="Arial" font-weight="bold">Ð</text>',
  ],
  ADA: [
    "#1956bf",
    '<circle cx="20" cy="20" r="3"/><g fill="white"><circle cx="20" cy="9" r="2"/><circle cx="20" cy="31" r="2"/><circle cx="10" cy="15" r="2"/><circle cx="30" cy="15" r="2"/><circle cx="10" cy="25" r="2"/><circle cx="30" cy="25" r="2"/></g>',
  ],
  AVAX: ["#e84142", '<path d="m18 9-12 22h16l-6-10 6-10zm8 12-5 10h12z"/>'],
  LINK: [
    "#2a5ada",
    '<path d="m20 6 12 7v14l-12 7-12-7V13zm0 6-7 4v8l7 4 7-4v-8z" fill-rule="evenodd"/>',
  ],
  LTC: [
    "#345d9d",
    '<text x="20" y="31" text-anchor="middle" font-size="30" font-family="Arial" font-weight="bold">Ł</text>',
  ],
};
export function assetLogo(asset) {
  const [color, mark] = marks[asset] || ["#146ac8", ""];
  return `<svg class="asset-logo" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="${color}"/><g fill="white">${mark}</g></svg>`;
}
