// Remembered choices (stored as JSON under "pc:prefs"). Pure logic: the
// localStorage access lives in src/ui/storage.js.
//
// Stores are remembered as the ones he turned OFF, so a site added in a
// later version starts on for anyone with remembered choices. With nothing
// remembered yet, only DEFAULT_STORES_ON are on (Kc's decision, SPEC
// section 2). Search words and price are not remembered; the Leave out box
// is (as "exclude"), and so is the Current / Sold switch (as "view").

import { CONDITIONS, FORMATS, DEFAULT_RADIUS, normalizeCity, normalizeRadius, normalizeZip } from "./query.js";
import { CATEGORIES, DEFAULT_CATEGORY } from "./categories.js";

export const PREFS_VERSION = 1;

export const DEFAULT_STORES_ON = ["ebay", "facebook", "mercari"];

// Which listings the links open: current ("asking") or sold.
export const VIEWS = ["asking", "sold"];

export function defaultPrefs(siteIds = []) {
  return {
    version: PREFS_VERSION,
    storesOff: siteIds.filter((id) => !DEFAULT_STORES_ON.includes(id)),
    condition: "any",
    format: "any",
    location: { zip: "", radius: DEFAULT_RADIUS, craigslistCity: "", facebookCity: "" },
    exclude: "",
    category: DEFAULT_CATEGORY,
    view: "asking",
  };
}

// Any bad or missing field falls back to its default; unknown store ids
// are dropped. Never throws.
export function parsePrefs(text, siteIds) {
  const prefs = defaultPrefs(siteIds);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return prefs;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return prefs;

  if (Array.isArray(data.storesOff)) {
    prefs.storesOff = [...new Set(data.storesOff.filter((id) => siteIds.includes(id)))];
  }
  if (CONDITIONS.includes(data.condition)) prefs.condition = data.condition;
  if (FORMATS.includes(data.format)) prefs.format = data.format;
  if (typeof data.exclude === "string") prefs.exclude = data.exclude.slice(0, 500);
  if (CATEGORIES.some((c) => c.id === data.category)) prefs.category = data.category;
  if (VIEWS.includes(data.view)) prefs.view = data.view;

  const loc = data.location;
  if (loc && typeof loc === "object") {
    prefs.location = {
      zip: normalizeZip(loc.zip),
      radius: normalizeRadius(loc.radius),
      craigslistCity: normalizeCity(loc.craigslistCity),
      facebookCity: normalizeCity(loc.facebookCity),
    };
  }
  return prefs;
}

export function serializePrefs(prefs) {
  return JSON.stringify(prefs);
}

export function selectedStores(prefs, siteIds) {
  return siteIds.filter((id) => !prefs.storesOff.includes(id));
}
