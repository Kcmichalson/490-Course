// Etsy search links (asking prices only; no sold view).
//
// Site features relied on (researched 2026-11-01 from third-party guides):
// - Search: https://www.etsy.com/search?q=<words>
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Price: min / max, whole dollars
// - Sort: order=most_recent
// - Condition, format, location: none
//
// Kc's check 13 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

export default {
  id: "etsy",
  name: "Etsy",
  lastChecked: "2026-11-01",
  views: ["asking"],
  supports: {
    exclude: false,
    price: true,
    condition: [],
    format: [],
    location: false,
  },
  notes: { sold: "", asking: "" },
  unconfirmed: [],

  buildUrl(search) {
    const url = new URL("https://www.etsy.com/search");
    const p = url.searchParams;
    const carried = new Set();

    p.set("q", joinWords(search.tokens, { quotes: false }));

    if (search.price.min !== null) p.set("min", String(search.price.min));
    if (search.price.max !== null) p.set("max", String(search.price.max));
    carried.add("price");

    p.set("order", "most_recent");
    return linkResult(url, search, carried);
  },
};
