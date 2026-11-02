// All ten site adapters, in SPEC section 5 order.

import { filterSummary } from "../query.js";
import ebay from "./ebay.js";
import mercari from "./mercari.js";
import facebook from "./facebook.js";
import craigslist from "./craigslist.js";
import offerup from "./offerup.js";
import etsy from "./etsy.js";
import poshmark from "./poshmark.js";
import shopgoodwill from "./shopgoodwill.js";
import amazon from "./amazon.js";
import walmart from "./walmart.js";

export const SITES = [
  ebay, mercari, facebook, craigslist, offerup,
  etsy, poshmark, shopgoodwill, amazon, walmart,
];

export const SITE_IDS = SITES.map((s) => s.id);

export const VIEW_LABELS = { sold: "Sold", asking: "Asking" };

// One link per selected site and view: all "sold" links first, then all
// "asking" links, each in SPEC order. This is also the "Open next" order.
export function buildLinks(search, selectedIds, today = new Date()) {
  const chosen = SITES.filter((s) => selectedIds.includes(s.id));
  const links = [];
  for (const view of ["sold", "asking"]) {
    for (const site of chosen) {
      if (!site.views.includes(view)) continue;
      const result = site.buildUrl(search, view, today);
      links.push({
        siteId: site.id,
        name: site.name,
        view,
        url: result.url,
        applied: result.applied,
        skipped: result.skipped,
        summary: filterSummary(result.applied, result.skipped),
        // An adapter may return a note for this link; else the site's note.
        note: result.note ?? site.notes?.[view] ?? "",
      });
    }
  }
  return links;
}
