import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitWords,
  joinWords,
  parseExclude,
  normalizePrice,
  normalizeZip,
  normalizeCity,
  normalizeRadius,
  buildSearch,
  requestedFilters,
  linkResult,
  filterSummary,
  QUICK_RANGES,
} from "../src/core/query.js";

test("splitWords keeps quoted phrases together", () => {
  assert.deepEqual(splitWords('star wars "black series" figure'), [
    { text: "star", quoted: false },
    { text: "wars", quoted: false },
    { text: "black series", quoted: true },
    { text: "figure", quoted: false },
  ]);
});

test("splitWords treats phone curly quotes as quotes", () => {
  assert.deepEqual(splitWords("“black series” figure"), [
    { text: "black series", quoted: true },
    { text: "figure", quoted: false },
  ]);
});

test("splitWords drops stray quotes, empty phrases and extra spaces", () => {
  assert.deepEqual(splitWords('  mid   century "" dresser 5"  '), [
    { text: "mid", quoted: false },
    { text: "century", quoted: false },
    { text: "dresser", quoted: false },
    { text: "5", quoted: false },
  ]);
  assert.deepEqual(splitWords(""), []);
  assert.deepEqual(splitWords(undefined), []);
});

test("joinWords keeps or strips quotes", () => {
  const tokens = splitWords('"black series" figure');
  assert.equal(joinWords(tokens, { quotes: true }), '"black series" figure');
  assert.equal(joinWords(tokens, { quotes: false }), "black series figure");
});

test("parseExclude splits on commas and spaces, drops dashes and duplicates", () => {
  assert.deepEqual(parseExclude("lot, Broken  -parts,lot;reprint"), ["lot", "broken", "parts", "reprint"]);
  assert.deepEqual(parseExclude("  , "), []);
  assert.deepEqual(parseExclude(undefined), []);
});

test("normalizePrice: blanks, negatives and junk become null", () => {
  assert.deepEqual(normalizePrice("", " "), { min: null, max: null, swapped: false });
  assert.deepEqual(normalizePrice("-5", "abc"), { min: null, max: null, swapped: false });
  assert.deepEqual(normalizePrice(null, undefined), { min: null, max: null, swapped: false });
});

test("normalizePrice: dollars signs, commas, decimals rounded outward", () => {
  assert.deepEqual(normalizePrice("$5.50", "1,249.99"), { min: 5, max: 1250, swapped: false });
  assert.deepEqual(normalizePrice("0", "20"), { min: 0, max: 20, swapped: false });
});

test("normalizePrice swaps min above max and says so", () => {
  assert.deepEqual(normalizePrice("50", "20"), { min: 20, max: 50, swapped: true });
});

test("quick ranges match SPEC section 4", () => {
  assert.deepEqual(
    QUICK_RANGES.map((r) => [r.label, r.min, r.max]),
    [["Under $20", null, 20], ["$20–$50", 20, 50], ["Over $50", 50, null]],
  );
});

test("normalizeZip accepts 5 digits or ZIP+4 only", () => {
  assert.equal(normalizeZip("98101"), "98101");
  assert.equal(normalizeZip(" 98101-1234 "), "98101");
  assert.equal(normalizeZip("9810"), "");
  assert.equal(normalizeZip("seattle"), "");
});

test("normalizeCity makes a site city name", () => {
  assert.equal(normalizeCity("Seattle, WA"), "seattle");
  assert.equal(normalizeCity(" San Francisco "), "sanfrancisco");
  assert.equal(normalizeCity("sea-ttle.org/x"), "seattleorgx");
  assert.equal(normalizeCity(""), "");
});

test("normalizeRadius falls back to 25 miles", () => {
  assert.equal(normalizeRadius("50"), 50);
  assert.equal(normalizeRadius(7), 25);
  assert.equal(normalizeRadius(undefined), 25);
});

test("buildSearch normalizes everything and defaults unknown choices to any", () => {
  const search = buildSearch({
    words: " russell  wilson “foil card” ",
    exclude: "lot",
    priceMin: "5",
    priceMax: "50",
    condition: "broken-value",
    format: "auction",
    location: { zip: "98101", radius: "10", craigslistCity: "Seattle", facebookCity: "" },
  });
  assert.equal(search.words, 'russell wilson "foil card"');
  assert.deepEqual(search.exclude, ["lot"]);
  assert.deepEqual(search.price, { min: 5, max: 50, swapped: false });
  assert.equal(search.condition, "any");
  assert.equal(search.format, "auction");
  assert.deepEqual(search.location, { zip: "98101", radius: 10, craigslistCity: "seattle", facebookCity: "" });
});

test("requestedFilters lists only filters he set", () => {
  assert.deepEqual(requestedFilters(buildSearch({ words: "x" })), []);
  assert.deepEqual(
    requestedFilters(buildSearch({ words: "x", priceMax: "20", condition: "used", location: { facebookCity: "nyc" } })),
    ["price", "condition", "location"],
  );
});

test("linkResult splits requested filters into applied and skipped", () => {
  const search = buildSearch({ words: "x", exclude: "lot", priceMin: "5", format: "auction" });
  const result = linkResult(new URL("https://example.com/?q=x"), search, new Set(["price", "condition"]));
  assert.equal(result.url, "https://example.com/?q=x");
  assert.deepEqual(result.applied, ["price"]);
  assert.deepEqual(result.skipped, ["exclude", "format"]);
});

test("filterSummary wording", () => {
  assert.equal(filterSummary([], []), "No filters set");
  assert.equal(filterSummary(["price", "condition"], []), "All filters");
  assert.equal(filterSummary(["price", "location"], ["condition"]), "Price and location only (can't do condition)");
  assert.equal(
    filterSummary(["price"], ["exclude", "format", "location"]),
    "Price only (can't do exclude words, buying format and location)",
  );
  assert.equal(filterSummary([], ["format"]), "No filters applied (can't do buying format)");
});
