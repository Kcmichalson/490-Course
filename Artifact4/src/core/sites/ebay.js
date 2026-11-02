// eBay (US) search links.
//
// Site features relied on (researched 2026-11-01 from third-party docs and
// eBay's developer docs; no official URL reference exists):
// - Search: https://www.ebay.com/sch/i.html?_nkw=<words>
// - Keyword syntax: -word excludes, "exact phrase" (search box) [medium-high]
// - Sold view: LH_Sold=1&LH_Complete=1, always both [high]. Since about
//   Aug 2026 eBay asks signed-out visitors to sign in for sold results [high]
// - Price: _udlo / _udhi, whole dollars [high]
// - Condition: LH_ItemCondition, codes joined with "|". 1000 New, 1500 New
//   other, 3000 Used; trading cards use 2750 Graded / 4000 Ungraded since
//   July 2023 [high]. The used codes also work on furniture (check 21)
// - Format: LH_Auction=1 / LH_BIN=1 [high]
// - Location: _stpos=<ZIP> + _sadis=<miles> + _fspt=1, as eBay wrote them
//   when Kc set "Distance from ZIP" (check 3). That URL also had _sacat=0
//   (all categories, the default) and _from=R40 (where the click came
//   from), which aren't filters, so they're left out; the app's shorter
//   link showed "25 miles from 98101" (check 26)
// - Sort: _sop=10 newly listed; _sop=13 ended recently
//
// Kc's by-eye checks 1, 2, 3, 20, 21 and 26 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

const BASE = "https://www.ebay.com/sch/i.html";

const CONDITION_CODES = {
  new: "1000|1500",
  used: "3000|2750|4000",
};

export default {
  id: "ebay",
  name: "eBay",
  lastChecked: "2026-11-01",
  views: ["sold", "asking"],
  supports: {
    exclude: true,
    price: true,
    condition: ["new", "used"],
    format: ["auction", "buyNow"],
    location: "zip+radius",
  },
  notes: {
    sold: "Sign in to eBay to see sold prices",
    asking: "",
  },
  unconfirmed: [],

  buildUrl(search, view) {
    const url = new URL(BASE);
    const p = url.searchParams;
    const carried = new Set();

    const words = [joinWords(search.tokens, { quotes: true })];
    if (search.exclude.length > 0) {
      words.push(...search.exclude.map((w) => `-${w}`));
      carried.add("exclude");
    }
    p.set("_nkw", words.join(" "));

    if (search.price.min !== null) p.set("_udlo", String(search.price.min));
    if (search.price.max !== null) p.set("_udhi", String(search.price.max));
    carried.add("price");

    if (CONDITION_CODES[search.condition]) {
      p.set("LH_ItemCondition", CONDITION_CODES[search.condition]);
    }
    carried.add("condition");

    if (search.format === "auction") p.set("LH_Auction", "1");
    if (search.format === "buyNow") p.set("LH_BIN", "1");
    carried.add("format");

    if (search.location.zip) {
      p.set("_stpos", search.location.zip);
      p.set("_sadis", String(search.location.radius));
      p.set("_fspt", "1");
      carried.add("location");
    }

    if (view === "sold") {
      p.set("LH_Sold", "1");
      p.set("LH_Complete", "1");
      p.set("_sop", "13");
    } else {
      p.set("_sop", "10");
    }
    return linkResult(url, search, carried);
  },
};
