// Amazon (US) search links (asking prices only; no sold view).
//
// Site features relied on (researched 2026-11-01 from third-party guides):
// - Search: https://www.amazon.com/s?k=<words>
// - Price: rh=p_36:<min cents>-<max cents> (check 18); min only, e.g.
//   "2000-" (check 23); max only, e.g. "-2000" (check 27)
// - Sort: s=date-desc-rank newest arrivals
// - Prime: not used. The researched Prime filter (p_85:2470955011 in rh)
//   showed no Prime checkbox for Kc when signed out (check 34), so it
//   couldn't be confirmed and was dropped. Ticking Amazon Prime under My
//   memberships only adds a note (src/core/memberships.js)
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Condition: category-specific ids, so none. Format, location: none
//
// Kc's checks 18, 23 and 27 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

export default {
  id: "amazon",
  name: "Amazon",
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
    const url = new URL("https://www.amazon.com/s");
    const p = url.searchParams;
    const carried = new Set();

    p.set("k", joinWords(search.tokens, { quotes: false }));

    const { min, max } = search.price;
    if (min !== null || max !== null) {
      const cents = (dollars) => (dollars === null ? "" : String(dollars * 100));
      p.set("rh", `p_36:${cents(min)}-${cents(max)}`);
    }
    carried.add("price");

    p.set("s", "date-desc-rank");
    return linkResult(url, search, carried);
  },
};
