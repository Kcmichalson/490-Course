// OfferUp search links (asking prices only; no sold view).
//
// Site features relied on (researched 2026-11-01 from third-party guides;
// OfferUp publishes no URL reference):
// - Search: https://offerup.com/search?q=<words>
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Price: price_min / price_max, whole dollars
// - Sort: sort=-posted newest
// - Location: not in the URL. When Kc changed the location and distance on
//   OfferUp, the address didn't change (check 12); OfferUp uses the
//   location set on its own site, so the app's location is skipped
// - Condition, format: none
//
// Kc's checks 11 and 12 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

export default {
  id: "offerup",
  name: "OfferUp",
  lastChecked: "2026-11-01",
  views: ["asking"],
  supports: {
    exclude: false,
    price: true,
    condition: [],
    format: [],
    location: false,
  },
  notes: { sold: "", asking: "Uses the location set on OfferUp's site" },
  unconfirmed: [],

  buildUrl(search) {
    const url = new URL("https://offerup.com/search");
    const p = url.searchParams;
    const carried = new Set();

    p.set("q", joinWords(search.tokens, { quotes: false }));

    if (search.price.min !== null) p.set("price_min", String(search.price.min));
    if (search.price.max !== null) p.set("price_max", String(search.price.max));
    carried.add("price");

    p.set("sort", "-posted");
    return linkResult(url, search, carried);
  },
};
