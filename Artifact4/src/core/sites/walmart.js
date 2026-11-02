// Walmart search links (asking prices only; no sold view).
//
// Site features relied on (researched 2026-11-01 from third-party guides):
// - Search: https://www.walmart.com/search?q=<words>
// - Price: min_price / max_price, whole dollars
// - Sort: sort=new
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Condition, format, location: none
//
// Kc's check 19 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

export default {
  id: "walmart",
  name: "Walmart",
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
    const url = new URL("https://www.walmart.com/search");
    const p = url.searchParams;
    const carried = new Set();

    p.set("q", joinWords(search.tokens, { quotes: false }));

    if (search.price.min !== null) p.set("min_price", String(search.price.min));
    if (search.price.max !== null) p.set("max_price", String(search.price.max));
    carried.add("price");

    p.set("sort", "new");
    return linkResult(url, search, carried);
  },
};
