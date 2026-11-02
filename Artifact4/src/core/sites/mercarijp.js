// Mercari Japan (jp.mercari.com) search links. Added in M4 at Kc's request;
// off by default. The search words are sent as typed (Kc's decision: no
// translation, which would need a translation service).
//
// Site features relied on (researched 2026-11-01 from third-party scraper
// docs; no official reference). Kc's checks 36 (current, newest first) and
// 37 (sold) passed on 2026-11-01:
// - Search: https://jp.mercari.com/search?keyword=<words> (Kc's example URL)
// - Current listings: status=on_sale; sold listings: status=sold_out
// - Sort: sort=created_time&order=desc (newest first)
// - Price: price_min / price_max are in yen, but the app's price is in
//   dollars, so price is skipped
// - Keyword syntax: no known exclude or exact-phrase support, so leave-outs
//   are skipped and quotes are stripped. Condition, format, location: none
//
// Buying from Mercari Japan is up to Kc (e.g. through a buying service); the
// app only opens the search.

import { joinWords, linkResult } from "../query.js";

export default {
  id: "mercarijp",
  name: "Mercari Japan",
  lastChecked: "2026-11-01",
  views: ["sold", "asking"],
  supports: {
    exclude: false,
    price: false,
    condition: [],
    format: [],
    location: false,
  },
  notes: {
    sold: "Japanese site: English words may find fewer results",
    asking: "Japanese site: English words may find fewer results",
  },
  unconfirmed: [],

  buildUrl(search, view) {
    const url = new URL("https://jp.mercari.com/search");
    const p = url.searchParams;
    p.set("keyword", joinWords(search.tokens, { quotes: false }));
    p.set("status", view === "sold" ? "sold_out" : "on_sale");
    p.set("sort", "created_time");
    p.set("order", "desc");
    return linkResult(url, search, new Set());
  },
};
