// Poshmark search links.
//
// Site features relied on (researched 2026-11-01 from third-party guides;
// Poshmark publishes no URL reference):
// - Search: https://poshmark.com/search?query=<words>&type=listings
// - Sold view: availability=sold_out
// - Condition: condition=closet_nwt (new with tags). No "used" filter, so
//   used is skipped
// - Price: price[]=<min>-<max>, from Kc's check 15 URL (price%5B%5D=25-50).
//   Any range, and one end only ("20-", "-20"), work (check 24)
// - Keyword syntax: no known exclude or exact-phrase support, so exclude
//   words are skipped and quotes are stripped
// - Sort: none (no check covered one). Format, location: none
// - Kc's confirmed URLs wrote spaces as %20, so this adapter does too
//
// Kc's checks 14, 15 and 24 passed on 2026-11-01.

import { encodeQuery, joinWords, linkResult } from "../query.js";

export default {
  id: "poshmark",
  name: "Poshmark",
  lastChecked: "2026-11-01",
  views: ["sold", "asking"],
  supports: {
    exclude: false,
    price: true,
    condition: ["new"],
    format: [],
    location: false,
  },
  notes: { sold: "", asking: "" },
  unconfirmed: [],

  buildUrl(search, view) {
    const url = new URL("https://poshmark.com/search");
    const p = url.searchParams;
    const carried = new Set();

    p.set("query", joinWords(search.tokens, { quotes: false }));
    p.set("type", "listings");

    const { min, max } = search.price;
    if (min !== null || max !== null) p.set("price[]", `${min ?? ""}-${max ?? ""}`);
    carried.add("price");

    if (search.condition === "new") {
      p.set("condition", "closet_nwt");
      carried.add("condition");
    }

    if (view === "sold") p.set("availability", "sold_out");
    url.search = encodeQuery(p);
    return linkResult(url, search, carried);
  },
};
