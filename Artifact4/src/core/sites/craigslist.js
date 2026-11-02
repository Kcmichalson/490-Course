// Craigslist search links (asking prices only; Craigslist has no sold view).
//
// Site features relied on (researched 2026-11-01):
// - Search: https://<city>.craigslist.org/search/sss?query=<words>
//   ("sss" = all for sale). With no city: www.craigslist.org (check 8)
// - Keyword syntax: "exact phrase" and -word excludes, per Craigslist's
//   own help page on search operators [high]
// - Price: min_price / max_price, whole dollars [high]
// - Condition: condition=<code>, repeated for several: 10 new, 20 like new,
//   30 excellent, 40 good, 50 fair, 60 salvage (checks 9 and 10)
// - Location: city subdomain; postal=<ZIP> + search_distance=<miles>
//   (distance needs postal) [high]
// - Sort: sort=date newest [high]. Format: none
//
// Kc's checks 8, 9 and 10 passed on 2026-11-01.

import { joinWords, linkResult } from "../query.js";

const CONDITION_CODES = {
  new: ["10"],
  used: ["20", "30", "40", "50"],
};

export default {
  id: "craigslist",
  name: "Craigslist",
  lastChecked: "2026-11-01",
  views: ["asking"],
  supports: {
    exclude: true,
    price: true,
    condition: ["new", "used"],
    format: [],
    location: "city+zip+radius",
  },
  notes: { sold: "", asking: "" },
  unconfirmed: [],

  buildUrl(search) {
    const city = search.location.craigslistCity;
    const host = city ? `${city}.craigslist.org` : "www.craigslist.org";
    const url = new URL(`https://${host}/search/sss`);
    const p = url.searchParams;
    const carried = new Set();

    const words = [joinWords(search.tokens, { quotes: true })];
    if (search.exclude.length > 0) {
      words.push(...search.exclude.map((w) => `-${w}`));
      carried.add("exclude");
    }
    p.set("query", words.join(" "));

    if (search.price.min !== null) p.set("min_price", String(search.price.min));
    if (search.price.max !== null) p.set("max_price", String(search.price.max));
    carried.add("price");

    for (const code of CONDITION_CODES[search.condition] ?? []) {
      p.append("condition", code);
    }
    carried.add("condition");

    if (search.location.zip) {
      p.set("postal", search.location.zip);
      p.set("search_distance", String(search.location.radius));
    }
    if (city || search.location.zip) carried.add("location");

    p.set("sort", "date");
    const result = linkResult(url, search, carried);
    if (!city) result.note = "No Craigslist city set (add one under Location)";
    return result;
  },
};
