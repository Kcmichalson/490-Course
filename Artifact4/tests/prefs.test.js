import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STORES_ON, defaultPrefs, parsePrefs, serializePrefs, selectedStores } from "../src/core/prefs.js";

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
  assert.equal(prefs.view, "asking");
  assert.equal("memberships" in prefs, false);
  assert.equal("category" in prefs, false); // the category hint was removed in M4
});

test("view (Current / Sold) is remembered; a bad value falls back to current", () => {
  const sold = serializePrefs({ ...defaultPrefs(IDS), view: "sold" });
  assert.equal(parsePrefs(sold, IDS).view, "sold");
  assert.equal(parsePrefs('{"view":"bought"}', IDS).view, "asking");
  // Old prefs with memberships (from M2) load; the field is dropped.
  assert.equal("memberships" in parsePrefs('{"memberships":["prime"]}', IDS), false);
});

test("remembered store choices stay as they are under the new default", () => {
  const allOn = serializePrefs({ ...defaultPrefs(MORE_IDS), storesOff: [] });
  assert.deepEqual(selectedStores(parsePrefs(allOn, MORE_IDS), MORE_IDS), MORE_IDS);
  const someOff = serializePrefs({ ...defaultPrefs(MORE_IDS), storesOff: ["ebay"] });
  assert.deepEqual(parsePrefs(someOff, MORE_IDS).storesOff, ["ebay"]);
  // Remembered prefs without a storesOff list fall back to the default.
  assert.deepEqual(parsePrefs('{"condition":"used"}', MORE_IDS).storesOff, ["craigslist", "etsy"]);
});

test("round trip keeps every remembered choice", () => {
  const prefs = {
    ...defaultPrefs(IDS),
    storesOff: ["mercari"],
    condition: "used",
    format: "buyNow",
    location: { zip: "98101", radius: 50, craigslistCity: "seattle", facebookCity: "seattle" },
    exclude: "lot, broken",
    view: "sold",
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
    category: "boats", // removed in M4: ignored
  });
  const prefs = parsePrefs(text, IDS);
  assert.deepEqual(prefs.storesOff, ["ebay"]);
  assert.equal(prefs.condition, "any");
  assert.equal(prefs.format, "any");
  assert.deepEqual(prefs.location, { zip: "", radius: 25, craigslistCity: "seattle", facebookCity: "" });
  assert.equal(prefs.exclude, "");
  assert.equal("category" in prefs, false);
});

// M4 (approved plan): a store added later starts at its default (off,
// unless it's one of DEFAULT_STORES_ON), even for someone with remembered
// choices. Was (M1): a store added later started on.
test("a store added later starts at its default; known stores keep his choice", () => {
  const saved = serializePrefs({ ...defaultPrefs(IDS), storesOff: ["mercari"], knownStores: IDS });
  const laterIds = [...IDS, "etsy", "facebook"];
  const prefs = parsePrefs(saved, laterIds);
  assert.deepEqual(selectedStores(prefs, laterIds), ["ebay", "craigslist", "facebook"]);
  assert.deepEqual(prefs.knownStores, laterIds);
});

test("remembered prefs from before knownStores: the ten original stores were known", () => {
  // Saved by an earlier version: no knownStores, all ten on.
  const old = JSON.stringify({ storesOff: [] });
  const ids = ["ebay", "mercari", "craigslist", "mercarijp"];
  assert.deepEqual(selectedStores(parsePrefs(old, ids), ids), ["ebay", "mercari", "craigslist"]);
});
