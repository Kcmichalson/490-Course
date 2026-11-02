// Saved searches (stored as JSON under "pc:saved"), plus export to and
// import from a JSON file. Pure logic: the localStorage and file access live
// in src/ui/. Every function returns a new list; none changes its input.
//
// A record keeps what was in the search bar and sidebar (not the built
// links), so links are rebuilt with the current site adapters: when a site
// URL is fixed, every saved search picks up the fix.
//
// { id, label, input: { words, priceMin, priceMax, condition, format,
//   exclude, category, storesOff, location: { zip, radius, craigslistCity,
//   facebookCity } }, created, updated }

import { CONDITIONS, FORMATS, normalizeCity, normalizePrice, normalizeRadius, normalizeZip } from "./query.js";
import { CATEGORIES, DEFAULT_CATEGORY } from "./categories.js";

export const SAVED_VERSION = 1;
export const EXPORT_APP = "price-check";
export const MAX_IMPORT_BYTES = 1_000_000;

export const IMPORT_MESSAGES = {
  notJson: "That file isn't a Price Check export (it isn't valid JSON).",
  notExport: "That file isn't a Price Check export.",
  newer: "That file is from a newer version of Price Check.",
  tooLarge: "That file is too large (over 1 MB).",
  empty: "That file has no saved searches in it.",
};

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isTime = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

// What the form held, checked with the same rules as remembered prefs.
// Returns null when there are no search words (nothing to save).
export function cleanInput(raw, siteIds) {
  if (!raw || typeof raw !== "object") return null;
  const words = text(raw.words, 500);
  if (!words) return null;
  const loc = raw.location && typeof raw.location === "object" ? raw.location : {};
  return {
    words,
    priceMin: text(raw.priceMin, 20),
    priceMax: text(raw.priceMax, 20),
    condition: CONDITIONS.includes(raw.condition) ? raw.condition : "any",
    format: FORMATS.includes(raw.format) ? raw.format : "any",
    exclude: text(raw.exclude, 500),
    category: CATEGORIES.some((c) => c.id === raw.category) ? raw.category : DEFAULT_CATEGORY,
    storesOff: Array.isArray(raw.storesOff)
      ? [...new Set(raw.storesOff.filter((id) => siteIds.includes(id)))]
      : [],
    location: {
      zip: normalizeZip(loc.zip),
      radius: normalizeRadius(loc.radius),
      craigslistCity: normalizeCity(loc.craigslistCity),
      facebookCity: normalizeCity(loc.facebookCity),
    },
  };
}

// One stored or imported record, or null if it can't be used.
function cleanRecord(raw, siteIds) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !/^[\w-]{1,64}$/.test(raw.id)) return null;
  const input = cleanInput(raw.input, siteIds);
  if (!input || !isTime(raw.created)) return null;
  return {
    id: raw.id,
    label: text(raw.label, 200) || input.words,
    input,
    created: raw.created,
    updated: isTime(raw.updated) ? raw.updated : raw.created,
  };
}

const newestFirst = (list) => [...list].sort((a, b) => b.created.localeCompare(a.created));

function cleanList(records, siteIds) {
  const seen = new Set();
  const list = [];
  for (const raw of records) {
    const record = cleanRecord(raw, siteIds);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      list.push(record);
    }
  }
  return newestFirst(list);
}

export function addSearch(list, rawInput, { id, now, siteIds }) {
  const input = cleanInput(rawInput, siteIds);
  if (!input) return list;
  return newestFirst([{ id, label: input.words, input, created: now, updated: now }, ...list]);
}

// New filters for an existing search; its label and created time stay.
export function updateSearch(list, id, rawInput, { now, siteIds }) {
  const input = cleanInput(rawInput, siteIds);
  if (!input) return list;
  return list.map((r) => (r.id === id ? { ...r, input, updated: now } : r));
}

// A blank label goes back to the search words.
export function renameSearch(list, id, label) {
  return list.map((r) => (r.id === id ? { ...r, label: text(label, 200) || r.input.words } : r));
}

export function deleteSearch(list, id) {
  return list.filter((r) => r.id !== id);
}

// Text matches the label or the words, ignoring case; category "all" (or
// blank) matches every search.
export function filterSearches(list, { text: query = "", category = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return list.filter((r) =>
    (!q || r.label.toLowerCase().includes(q) || r.input.words.toLowerCase().includes(q)) &&
    (!category || category === "all" || r.input.category === category));
}

// One-line description for a saved-search card: "$5–$50 · Used · 10 stores".
export function summarizeInput(input, siteCount) {
  const parts = [];
  const { min, max } = normalizePrice(input.priceMin, input.priceMax);
  if (min !== null && max !== null) parts.push(`$${min}–$${max}`);
  else if (min !== null) parts.push(`$${min} and up`);
  else if (max !== null) parts.push(`Up to $${max}`);
  if (input.condition === "new") parts.push("New");
  if (input.condition === "used") parts.push("Used");
  if (input.format === "auction") parts.push("Auction");
  if (input.format === "buyNow") parts.push("Buy now");
  if (input.exclude) parts.push(`Not: ${input.exclude}`);
  if (input.location.zip) parts.push(`Near ${input.location.zip}`);
  const stores = siteCount - input.storesOff.length;
  parts.push(`${stores} ${stores === 1 ? "store" : "stores"}`);
  return parts.join(" · ");
}

// Browser storage: bad or missing data gives an empty list. Never throws.
export function serializeSaved(list) {
  return JSON.stringify({ version: SAVED_VERSION, searches: list });
}

export function parseSaved(stored, siteIds) {
  let data;
  try {
    data = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.searches)) return [];
  return cleanList(data.searches, siteIds);
}

// The export file's contents.
export function exportText(list, now) {
  return JSON.stringify({ app: EXPORT_APP, version: SAVED_VERSION, exported: now, searches: list }, null, 2);
}

// Named with his local date (an ISO time is UTC, a day ahead in the evening).
export function exportFileName(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `price-check-searches-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// An import file: { ok: true, searches } or { ok: false, message }.
export function parseImport(fileText) {
  if (typeof fileText !== "string") return { ok: false, message: IMPORT_MESSAGES.notExport };
  if (fileText.length > MAX_IMPORT_BYTES) return { ok: false, message: IMPORT_MESSAGES.tooLarge };
  let data;
  try {
    data = JSON.parse(fileText);
  } catch {
    return { ok: false, message: IMPORT_MESSAGES.notJson };
  }
  if (!data || typeof data !== "object" || data.app !== EXPORT_APP || !Array.isArray(data.searches)) {
    return { ok: false, message: IMPORT_MESSAGES.notExport };
  }
  if (typeof data.version !== "number" || data.version > SAVED_VERSION) {
    return { ok: false, message: IMPORT_MESSAGES.newer };
  }
  return { ok: true, searches: data.searches };
}

// Adds imported searches whose id isn't already saved.
export function mergeImport(list, searches, siteIds) {
  const incoming = cleanList(searches, siteIds);
  if (incoming.length === 0) return { ok: false, list, message: IMPORT_MESSAGES.empty };
  const have = new Set(list.map((r) => r.id));
  const added = incoming.filter((r) => !have.has(r.id));
  const skipped = incoming.length - added.length;
  return {
    ok: true,
    list: newestFirst([...list, ...added]),
    message: importMessage(added.length, skipped),
  };
}

export function importMessage(added, skipped) {
  const noun = (n) => `${n} ${n === 1 ? "search" : "searches"}`;
  if (added === 0) return `Nothing new to import (${skipped === 1 ? "it was" : `all ${skipped} were`} already saved).`;
  const tail = skipped ? ` (${skipped} ${skipped === 1 ? "was" : "were"} already saved)` : "";
  return `Imported ${noun(added)}${tail}.`;
}
