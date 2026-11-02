// Facebook Marketplace search links (asking prices only; no sold view).
//
// Site features relied on (researched 2026-11-01 from third-party guides;
// Facebook publishes no URL reference):
// - Search: https://www.facebook.com/marketplace/search/?query=<words>.
//   With no city in the path, Facebook uses his account's location
// - City: https://www.facebook.com/marketplace/<city>/search/?query=...
//   (check 22)
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Price: minPrice / maxPrice, whole dollars
// - Condition: itemCondition, comma list: new; used_like_new, used_good,
//   used_fair (checks 7 and 22)
// - Sort: sortBy=creation_time_descend newest. Format: none
// - Kc's confirmed URL wrote spaces as %20 and commas plain, so this
//   adapter does too
//
// Kc's checks 7 (no city, used) and 22 (city, new) passed on 2026-11-01.

import { encodeQuery, joinWords, linkResult } from "../query.js";

const CONDITION_CODES = {
  new: "new",
  used: "used_like_new,used_good,used_fair",
};

export default {
  id: "facebook",
  name: "Facebook Marketplace",
  lastChecked: "2026-11-01",
  views: ["asking"],
  supports: {
    exclude: false,
    price: true,
    condition: ["new", "used"],
    format: [],
    location: "city",
  },
  notes: { sold: "", asking: "" },
  unconfirmed: [],

  buildUrl(search) {
    const city = search.location.facebookCity;
    const path = city ? `/marketplace/${city}/search/` : "/marketplace/search/";
    const url = new URL(`https://www.facebook.com${path}`);
    const p = url.searchParams;
    const carried = new Set();

    p.set("query", joinWords(search.tokens, { quotes: false }));

    if (search.price.min !== null) p.set("minPrice", String(search.price.min));
    if (search.price.max !== null) p.set("maxPrice", String(search.price.max));
    carried.add("price");

    if (CONDITION_CODES[search.condition]) {
      p.set("itemCondition", CONDITION_CODES[search.condition]);
    }
    carried.add("condition");

    if (city) carried.add("location");

    p.set("sortBy", "creation_time_descend");
    url.search = encodeQuery(p);
    const result = linkResult(url, search, carried);
    if (!city) result.note = "No Facebook city set, so Facebook uses your account's location";
    return result;
  },
};
