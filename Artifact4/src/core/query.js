// Turns what he typed into one normalized search object, and describes
// which filters a site link carried. Pure logic: no DOM, runs in Node.

// Filter keys in the order they're listed on buttons.
export const FILTER_KEYS = ["exclude", "price", "condition", "format", "location"];

const FILTER_LABELS = {
  exclude: "exclude words",
  price: "price",
  condition: "condition",
  format: "buying format",
  location: "location",
};

export const CONDITIONS = ["any", "new", "used"];
export const FORMATS = ["any", "auction", "buyNow"];
export const RADII = [5, 10, 25, 50, 100];
export const DEFAULT_RADIUS = 25;

export const QUICK_RANGES = [
  { id: "under20", label: "Under $20", min: null, max: 20 },
  { id: "20to50", label: "$20–$50", min: 20, max: 50 },
  { id: "over50", label: "Over $50", min: 50, max: null },
];

// Splits search words into tokens, keeping "quoted phrases" together.
// Phone keyboards type curly quotes, so those count as quotes too.
export function splitWords(text) {
  const clean = String(text ?? "").replace(/[“”„‟″]/g, '"');
  const tokens = [];
  for (const match of clean.matchAll(/"([^"]*)"|(\S+)/g)) {
    const quoted = match[1] !== undefined;
    const value = (quoted ? match[1] : match[2]).replace(/"/g, "").trim().replace(/\s+/g, " ");
    if (value) tokens.push({ text: value, quoted });
  }
  return tokens;
}

// Rebuilds the words for a site: phrases keep their quotes only where the
// site honors exact-phrase search.
export function joinWords(tokens, { quotes }) {
  return tokens.map((t) => (t.quoted && quotes ? `"${t.text}"` : t.text)).join(" ");
}

// "lot, broken  -parts" -> ["lot", "broken", "parts"]
export function parseExclude(text) {
  const words = String(text ?? "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((w) => w.replace(/^-+/, "").replace(/["“”]/g, ""))
    .filter(Boolean);
  return [...new Set(words)];
}

// Whole dollars, or null for blank/invalid. Decimals round outward
// (min down, max up) so a filter never hides an item he asked for.
function toDollars(value, round) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/^\$/, "").replace(/,/g, "");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return round(n);
}

export function normalizePrice(min, max) {
  let lo = toDollars(min, Math.floor);
  let hi = toDollars(max, Math.ceil);
  let swapped = false;
  if (lo !== null && hi !== null && lo > hi) {
    [lo, hi] = [hi, lo];
    swapped = true;
  }
  return { min: lo, max: hi, swapped };
}

// "98101-1234" -> "98101"; anything that isn't a US ZIP -> "".
export function normalizeZip(text) {
  const match = String(text ?? "").trim().match(/^(\d{5})(-\d{4})?$/);
  return match ? match[1] : "";
}

// "Seattle, WA" -> "seattle". Site city names are lowercase letters/digits.
export function normalizeCity(text) {
  return String(text ?? "").split(",")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeRadius(value) {
  const n = Number(value);
  return RADII.includes(n) ? n : DEFAULT_RADIUS;
}

// input: { words, exclude, priceMin, priceMax, condition, format,
//          location: { zip, radius, craigslistCity, facebookCity } }
export function buildSearch(input = {}) {
  const tokens = splitWords(input.words);
  const location = input.location ?? {};
  return {
    words: joinWords(tokens, { quotes: true }),
    tokens,
    exclude: parseExclude(input.exclude),
    price: normalizePrice(input.priceMin, input.priceMax),
    condition: CONDITIONS.includes(input.condition) ? input.condition : "any",
    format: FORMATS.includes(input.format) ? input.format : "any",
    location: {
      zip: normalizeZip(location.zip),
      radius: normalizeRadius(location.radius),
      craigslistCity: normalizeCity(location.craigslistCity),
      facebookCity: normalizeCity(location.facebookCity),
    },
  };
}

// The filters he actually set (left-at-"any" filters aren't listed).
export function requestedFilters(search) {
  const { exclude, price, condition, format, location } = search;
  const set = {
    exclude: exclude.length > 0,
    price: price.min !== null || price.max !== null,
    condition: condition !== "any",
    format: format !== "any",
    location: Boolean(location.zip || location.craigslistCity || location.facebookCity),
  };
  return FILTER_KEYS.filter((key) => set[key]);
}

// What an adapter returns: the link, plus which requested filters it
// carried (applied) and which it couldn't (skipped).
export function linkResult(url, search, carried) {
  const requested = requestedFilters(search);
  return {
    url: url.toString(),
    applied: requested.filter((key) => carried.has(key)),
    skipped: requested.filter((key) => !carried.has(key)),
  };
}

// A query string with spaces as %20 and commas left plain, for sites whose
// confirmed URLs look like that (URLSearchParams writes + and %2C). Keys
// are encoded too, so Poshmark's price[] becomes price%5B%5D.
export function encodeQuery(params) {
  return [...params]
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%2C/g, ",")}`)
    .join("&");
}

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Button text: "All filters", "Price and location only (can't do condition)".
export function filterSummary(applied, skipped) {
  const label = (keys) => joinList(keys.map((key) => FILTER_LABELS[key]));
  if (applied.length === 0 && skipped.length === 0) return "No filters set";
  if (skipped.length === 0) return "All filters";
  if (applied.length === 0) return `No filters applied (can't do ${label(skipped)})`;
  return `${capitalize(label(applied))} only (can't do ${label(skipped)})`;
}
