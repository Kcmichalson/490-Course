import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STORES_ON, defaultPrefs, parsePrefs, serializePrefs, selectedStores } from "../src/core/prefs.js";
import { suggestionFor } from "../src/core/categories.js";

const IDS = ["ebay", "mercari", "craigslist"];
const MORE_IDS = ["ebay", "mercari", "facebook", "craigslist", "etsy"];

// Kc's decision (2026-11-01): with nothing remembered, only eBay, Facebook
// Marketplace and Mercari are on. (Was: all stores on.)
test("defaults: eBay, Facebook and Mercari on, filters at any, location blank", () => {
  assert.deepEqual(DEFAULT_STORES_ON, ["ebay", "facebook", "mercari"]);
  const prefs = defaultPrefs(MORE_IDS);
  assert.deepEqual(prefs.storesOff, ["craigslist", "etsy"]);
  assert.deepEqual(selectedStores(prefs, MORE_IDS), ["ebay", "mercari", "facebook"]);
  assert.equal(prefs.condition, "any");
  assert.equal(prefs.format, "any");
  assert.deepEqual(prefs.location, { zip: "", radius: 25, craigslistCity: "", facebookCity: "" });
  assert.equal(prefs.exclude, "");
  assert.equal(prefs.category, "other");
  assert.deepEqual(prefs.memberships, []);
});

test("remembered store choices stay as they are under the new default", () => {
  const allOn = serializePrefs({ ...defaultPrefs(MORE_IDS), storesOff: [] });
  assert.deepEqual(selectedStores(parsePrefs(allOn, MORE_IDS), MORE_IDS), MORE_IDS);
  const someOff = serializePrefs({ ...defaultPrefs(MORE_IDS), storesOff: ["ebay"] });
  assert.deepEqual(parsePrefs(someOff, MORE_IDS).storesOff, ["ebay"]);
  // Remembered prefs without a storesOff list fall back to the default.
  assert.deepEqual(parsePrefs('{"condition":"used"}', MORE_IDS).storesOff, ["craigslist", "etsy"]);
});

test("memberships: kept in list order, unknown ids and duplicates dropped", () => {
  const text = JSON.stringify({ memberships: ["walmartplus", "costco", "prime", "prime", 3] });
  assert.deepEqual(parsePrefs(text, IDS).memberships, ["prime", "walmartplus"]);
  assert.deepEqual(parsePrefs(JSON.stringify({ memberships: "prime" }), IDS).memberships, []);
  const prefs = { ...defaultPrefs(), memberships: ["prime"] };
  assert.deepEqual(parsePrefs(serializePrefs(prefs), IDS), prefs);
});

test("round trip keeps every remembered choice", () => {
  const prefs = {
    ...defaultPrefs(),
    storesOff: ["mercari"],
    condition: "used",
    format: "buyNow",
    location: { zip: "98101", radius: 50, craigslistCity: "seattle", facebookCity: "seattle" },
    exclude: "lot, broken",
    category: "furniture",
  };
  assert.deepEqual(parsePrefs(serializePrefs(prefs), IDS), prefs);
  assert.deepEqual(selectedStores(prefs, IDS), ["ebay", "craigslist"]);
});

test("missing, empty or corrupt storage gives defaults", () => {
  for (const text of [null, "", "{not json", "[1,2]", "42", "null"]) {
    assert.deepEqual(parsePrefs(text, IDS), defaultPrefs(IDS), `input: ${text}`);
  }
});

test("unknown store ids and bad values are dropped", () => {
  const text = JSON.stringify({
    storesOff: ["ebay", "myspace", "ebay", 7],
    condition: "mint",
    format: 3,
    location: { zip: "abc", radius: 9999, craigslistCity: "Seattle, WA", facebookCity: null },
    exclude: { not: "a string" },
    category: "boats",
  });
  const prefs = parsePrefs(text, IDS);
  assert.deepEqual(prefs.storesOff, ["ebay"]);
  assert.equal(prefs.condition, "any");
  assert.equal(prefs.format, "any");
  assert.deepEqual(prefs.location, { zip: "", radius: 25, craigslistCity: "seattle", facebookCity: "" });
  assert.equal(prefs.exclude, "");
  assert.equal(prefs.category, "other");
});

test("a site added later starts on (stores are remembered as turned off)", () => {
  const saved = serializePrefs({ ...defaultPrefs(), storesOff: ["mercari"] });
  const laterIds = [...IDS, "etsy"];
  assert.deepEqual(selectedStores(parsePrefs(saved, laterIds), laterIds), ["ebay", "craigslist", "etsy"]);
});

test("category suggestions are limited to stores this build has", () => {
  assert.deepEqual(suggestionFor("cards", IDS), { stores: ["ebay", "mercari"], exclude: ["lot", "reprint", "custom"] });
  assert.deepEqual(suggestionFor("furniture", IDS), { stores: ["craigslist"], exclude: ["parts", "broken"] });
  assert.deepEqual(suggestionFor("other", IDS), { stores: [], exclude: [] });
  assert.deepEqual(suggestionFor("nonsense", IDS), { stores: [], exclude: [] });
});
