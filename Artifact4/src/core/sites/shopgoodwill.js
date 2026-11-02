// ShopGoodwill search links.
//
// Site features relied on (researched 2026-11-01 from third-party guides;
// ShopGoodwill publishes no URL reference). Kc's checks showed the site's
// short links are unreliable, so the links copy the full query the site
// itself writes, except the one short form Kc confirmed (check 16):
// - Search: https://shopgoodwill.com/categories/listing?st=<words>&...
// - Price: lp / hp, whole dollars. An empty or missing lp/hp makes the page
//   drop the words (checks 28, 28b, 28d); lp=0&hp=999999 works (28c), so
//   an unset end uses 0 or 999999, including one end only (check 30)
// - Sold view: closed auctions, from Kc's check 17 URL: sca=true,
//   caed=<today as M/D/YYYY> (end date), cadb=30 (days back), sus=true.
//   Only the full query works with words (25c; the short form failed, 25b)
// - Asking view: with both price ends set, the short form
//   st=<words>&lp=<min>&hp=<max> (check 16). Otherwise Kc's own manual
//   "Lamp" search URL (check 32): the full query with sca=false, cadb=7,
//   sus=false, ihp=true, because the short form stalled with no price
//   (checks 29, 31). One end only uses the full form too (check 33)
// - Keyword syntax: quotes are stripped (quoted searches were reported to
//   fail); no known exclude support
// - Sort, buy-now: unconfirmed, not used. Condition, location: none
// - Kc's confirmed URLs wrote spaces as %20, so this adapter does too
//
// Kc's checks 16, 17, 25, 28c, 30, 32 and 33 passed on 2026-11-01.

import { encodeQuery, joinWords, linkResult } from "../query.js";

// The site's full listing query, param for param: check 17 (closed) and
// Kc's manual search (live). An unset price end can't be empty (check 28c).
function listingQuery(words, price, today, closed) {
  const date = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  return [
    ["st", words], ["sg", ""], ["c", ""], ["s", ""],
    ["lp", String(price.min ?? 0)],
    ["hp", String(price.max ?? 999999)],
    ["sbn", ""], ["spo", "false"], ["snpo", "false"], ["socs", "false"], ["sd", "false"],
    ["sca", String(closed)], ["caed", date], ["cadb", closed ? "30" : "7"],
    ["scs", "false"], ["sis", "false"], ["col", "1"], ["p", "1"], ["ps", "40"],
    ["desc", "false"], ["ss", "0"], ["UseBuyerPrefs", "true"], ["sus", String(closed)],
    ["cln", "1"], ["catIds", ""], ["pn", ""], ["wc", "false"], ["mci", "false"],
    ["hmt", "false"], ["layout", "grid"], ["ihp", closed ? "" : "true"],
  ];
}

export default {
  id: "shopgoodwill",
  name: "ShopGoodwill",
  lastChecked: "2026-11-01",
  views: ["sold", "asking"],
  supports: {
    exclude: false,
    price: true,
    condition: [],
    format: [],
    location: false,
  },
  notes: { sold: "Closed auctions from the last 30 days", asking: "" },
  unconfirmed: [],

  buildUrl(search, view, today = new Date()) {
    const url = new URL("https://shopgoodwill.com/categories/listing");
    const words = joinWords(search.tokens, { quotes: false });
    const { min, max } = search.price;
    if (view === "asking" && min !== null && max !== null) {
      url.search = encodeQuery([["st", words], ["lp", String(min)], ["hp", String(max)]]);
    } else {
      url.search = encodeQuery(listingQuery(words, search.price, today, view === "sold"));
    }
    return linkResult(url, search, new Set(["price"]));
  },
};
