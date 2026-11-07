// Shareable search links (M5). The app's own address holds the current
// search after "#", so it is never sent to the server. Pure logic: no DOM.
//
// Keys (short, and left out when at their default):
//   q  Search for            x  Leave out          v=s  Sold listings
//   st selected store ids (always written; they're the point of the link)
//   lo / hi  price            c  condition n|u      f  format a|b
//   z r cl fb  ZIP, radius, Craigslist city, Facebook city (only with
//              "Include my location")
// e.g. #q=russell%20wilson%20foil%20card&x=reprint&v=s&st=ebay,mercari&lo=5&hi=50

import {
  CONDITIONS, DEFAULT_RADIUS, FORMATS, RADII, encodeQuery,
  normalizeCity, normalizePrice, normalizeZip,
} from "./query.js";
import { DEFAULT_STORES_ON } from "./prefs.js";

const CONDITION_CODES = { new: "n", used: "u" };
const FORMAT_CODES = { auction: "a", buyNow: "b" };
const MAX_TEXT = 500;

const codeOf = (codes, value) => codes[value];
const valueOf = (codes, code) => Object.keys(codes).find((k) => codes[k] === code);

// state: { words, exclude, view, storesOn: [ids], priceMin, priceMax,
//          condition, format, location: { zip, radius, craigslistCity,
//          facebookCity } }
// Returns "" when there are no search words (nothing to share).
export function encodeShare(state, { includeLocation = false } = {}) {
  const words = String(state.words ?? "").trim();
  if (!words) return "";
  const pairs = [["q", words]];
  const exclude = String(state.exclude ?? "").trim();
  if (exclude) pairs.push(["x", exclude]);
  if (state.view === "sold") pairs.push(["v", "s"]);
  pairs.push(["st", (state.storesOn ?? []).join(",")]);
  const { min, max } = normalizePrice(state.priceMin, state.priceMax);
  if (min !== null) pairs.push(["lo", String(min)]);
  if (max !== null) pairs.push(["hi", String(max)]);
  if (codeOf(CONDITION_CODES, state.condition)) pairs.push(["c", CONDITION_CODES[state.condition]]);
  if (codeOf(FORMAT_CODES, state.format)) pairs.push(["f", FORMAT_CODES[state.format]]);
  if (includeLocation && state.location) {
    const zip = normalizeZip(state.location.zip);
    const radius = Number(state.location.radius);
    const cl = normalizeCity(state.location.craigslistCity);
    const fb = normalizeCity(state.location.facebookCity);
    if (zip) pairs.push(["z", zip]);
    if (zip && RADII.includes(radius) && radius !== DEFAULT_RADIUS) pairs.push(["r", String(radius)]);
    if (cl) pairs.push(["cl", cl]);
    if (fb) pairs.push(["fb", fb]);
  }
  return `#${encodeQuery(pairs)}`;
}

// The fields a link carries, each checked; anything unreadable is left out
// so the visitor's own settings stay for it. Never throws: garbage -> {}.
export function decodeShare(hash, siteIds) {
  let params;
  try {
    params = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  } catch {
    return {};
  }
  const text = (key) => (params.get(key) ?? "").trim().slice(0, MAX_TEXT);
  const out = {};

  if (text("q")) out.words = text("q");
  if (params.has("x")) out.exclude = text("x");
  if (params.has("v")) out.view = params.get("v") === "s" ? "sold" : "asking";
  if (params.has("st")) {
    const ids = [...new Set(text("st").split(",").map((s) => s.trim()).filter((id) => siteIds.includes(id)))];
    if (ids.length) out.storesOn = ids;
  }
  if (params.has("lo") || params.has("hi")) {
    const { min, max } = normalizePrice(params.get("lo"), params.get("hi"));
    if (min !== null) out.priceMin = String(min);
    if (max !== null) out.priceMax = String(max);
  }
  const condition = valueOf(CONDITION_CODES, params.get("c"));
  if (condition && CONDITIONS.includes(condition)) out.condition = condition;
  const format = valueOf(FORMAT_CODES, params.get("f"));
  if (format && FORMATS.includes(format)) out.format = format;

  const location = {};
  if (normalizeZip(params.get("z"))) location.zip = normalizeZip(params.get("z"));
  if (RADII.includes(Number(params.get("r")))) location.radius = Number(params.get("r"));
  if (normalizeCity(params.get("cl"))) location.craigslistCity = normalizeCity(params.get("cl"));
  if (normalizeCity(params.get("fb"))) location.facebookCity = normalizeCity(params.get("fb"));
  if (Object.keys(location).length) out.location = location;
  return out;
}

// What opening a link sets. A link leaves out settings at their default,
// so a missing one means "the default", not "keep yours" (Kc: "falls back
// to defaults for the rest"). Location isn't part of a link unless it was
// included, so the visitor's own location stays. A link with no search
// words sets nothing.
export function linkSettings(shared, siteIds) {
  if (!shared.words) return {};
  return {
    exclude: "",
    view: "asking",
    storesOn: siteIds.filter((id) => DEFAULT_STORES_ON.includes(id)),
    priceMin: "",
    priceMax: "",
    condition: "any",
    format: "any",
    ...shared,
  };
}
