const paths = {
  gift: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3zM12 8h4a3 3 0 1 0-3-3z",
  mail: "M3 5h18v14H3zM3 5l9 7 9-7",
  logout: "M9 4H4v16h5M9 12h12m-5-5 5 5-5 5",
  menu: "M4 6h16M4 12h16M4 18h16",
  copy: "M9 9h11v11H9zM5 15H3V3h12v2",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6",
  support:
    "M4 14v-3a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-4M4 11H2v7h4v-7zM20 11h2v7h-4v-7z",
  wallet: "M3 6h17v15H3zM3 6V3h14v3M15 12h7v5h-7z",
  trade: "M4 7h16l-4-4M20 17H4l4 4M20 7l-4 4M4 17l4-4",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2",
  deposit: "M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6",
  withdraw: "M12 15V3m-5 5 5-5 5 5M4 15v6h16v-6",
  bell: "M18 8a6 6 0 0 0-12 0c0 8-3 8-3 9h18c0-1-3-1-3-9M10 21h4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  search: "M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
};
export const icon = (name) =>
  `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;
