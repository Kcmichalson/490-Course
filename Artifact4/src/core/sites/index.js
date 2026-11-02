// All site adapters, in SPEC section 5 order (Mercari Japan added in M4).

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
import mercarijp from "./mercarijp.js";

export const SITES = [
  ebay, mercari, facebook, craigslist, offerup,
  etsy, poshmark, shopgoodwill, amazon, walmart, mercarijp,
];

export const SITE_IDS = SITES.map((s) => s.id);

export const VIEW_LABELS = { sold: "Sold", asking: "Asking" };

// One link per selected site that has the chosen view ("asking" = current
// listings, "sold" = sold listings; anything else counts as "asking"), in
// SPEC order. This is also the Open all / Open next order.
export function buildLinks(search, selectedIds, today = new Date(), view = "asking") {
  const shown = view === "sold" ? "sold" : "asking";
  return SITES
    .filter((s) => selectedIds.includes(s.id) && s.views.includes(shown))
    .map((site) => {
      const result = site.buildUrl(search, shown, today);
      return {
        siteId: site.id,
        name: site.name,
        view: shown,
        url: result.url,
        applied: result.applied,
        skipped: result.skipped,
        summary: filterSummary(result.applied, result.skipped),
        // An adapter may return a note for this link; else the site's note.
        notes: [result.note ?? site.notes?.[shown] ?? ""].filter(Boolean),
      };
    });
}

// Selected stores that have no link for this view (only sold can be
// missing), for the "No sold view: …" line.
export function storesWithoutView(selectedIds, view) {
  return SITES.filter((s) => selectedIds.includes(s.id) && !s.views.includes(view)).map((s) => s.name);
}
