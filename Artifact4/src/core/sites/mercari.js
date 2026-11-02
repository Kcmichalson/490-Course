// Mercari (US) search links.
//
// Site features relied on (researched 2026-11-01 from third-party scraper
// docs; Mercari publishes no URL reference):
// - Search: https://www.mercari.com/search/?keyword=<words>
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped [low]
// - Sold view: itemStatuses=2-3 (2 in escrow + 3 sold). Research disputed
//   it against status=sold_out; Kc's checks 4 and 5 both passed, so the
//   app keeps itemStatuses=2-3
// - Price: priceMin / priceMax, whole dollars [medium-high]
// - Condition: itemConditions, comma list: 1 New, 2 Like New, 3 Good,
//   4 Fair, 5 Poor [medium-high]
// - Format: none (fixed price only). Location: none (shipped only)
// - Sort: sortBy=created_time newest [medium]; no "recently sold" sort
//
// Kc's checks 4, 5 and 6 passed on 2026-11-01. The app writes the
// condition list as 2%2C3%2C4%2C5; that link passed Kc's M1a by-eye check.

import { joinWords, linkResult } from "../query.js";

const BASE = "https://www.mercari.com/search/";

const CONDITION_CODES = {
  new: "1",
  used: "2,3,4,5",
};

export default {
  id: "mercari",
  name: "Mercari",
  lastChecked: "2026-11-01",
  views: ["sold", "asking"],
  supports: {
    exclude: false,
    price: true,
    condition: ["new", "used"],
    format: [],
    location: false,
  },
  notes: { sold: "", asking: "" },
  unconfirmed: [],

  buildUrl(search, view) {
    const url = new URL(BASE);
    const p = url.searchParams;
    const carried = new Set();

    p.set("keyword", joinWords(search.tokens, { quotes: false }));

    if (search.price.min !== null) p.set("priceMin", String(search.price.min));
    if (search.price.max !== null) p.set("priceMax", String(search.price.max));
    carried.add("price");

    if (CONDITION_CODES[search.condition]) {
      p.set("itemConditions", CONDITION_CODES[search.condition]);
    }
    carried.add("condition");

    if (view === "sold") {
      p.set("itemStatuses", "2-3");
    } else {
      p.set("sortBy", "created_time");
    }
    return linkResult(url, search, carried);
  },
};
