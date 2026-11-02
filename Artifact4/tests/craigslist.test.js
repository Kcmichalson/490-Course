import { test } from "node:test";
import assert from "node:assert/strict";
import craigslist from "../src/core/sites/craigslist.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = craigslist.buildUrl(buildSearch({ words: "mid century dresser", ...input }), "asking");
  return { ...result, parsed: new URL(result.url), params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(craigslist.views, ["asking"]);
});

test("plain words, no city: www host and a note (check 8)", () => {
  const { parsed, params, note, applied, skipped } = build({});
  assert.equal(parsed.origin + parsed.pathname, "https://www.craigslist.org/search/sss");
  assert.equal(params.get("query"), "mid century dresser");
  assert.equal(params.get("sort"), "date");
  assert.equal(note, "No Craigslist city set (add one under Location)");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("exclusions and quoted phrases go in the query", () => {
  const { params, applied } = build({ words: '"mid century" dresser', exclude: "parts, broken" });
  assert.equal(params.get("query"), '"mid century" dresser -parts -broken');
  assert.deepEqual(applied, ["exclude"]);
});

test("price range", () => {
  const { params } = build({ priceMin: "50" });
  assert.equal(params.get("min_price"), "50");
  assert.equal(params.get("max_price"), null);
});

test("condition codes, repeated", () => {
  assert.deepEqual(build({ condition: "new" }).params.getAll("condition"), ["10"]);
  assert.deepEqual(build({ condition: "used" }).params.getAll("condition"), ["20", "30", "40", "50"]);
  assert.deepEqual(build({ condition: "any" }).params.getAll("condition"), []);
});

test("buying format is skipped", () => {
  assert.deepEqual(build({ format: "buyNow" }).skipped, ["format"]);
});

test("location: city subdomain, ZIP and distance", () => {
  const { parsed, params, note, applied } = build({
    location: { zip: "98101", radius: "10", craigslistCity: "Seattle" },
  });
  assert.equal(parsed.hostname, "seattle.craigslist.org");
  assert.equal(params.get("postal"), "98101");
  assert.equal(params.get("search_distance"), "10");
  assert.equal(note, undefined);
  assert.deepEqual(applied, ["location"]);
});

test("a city alone counts as location; no distance without a ZIP", () => {
  const { params, applied } = build({ location: { craigslistCity: "seattle" } });
  assert.equal(params.get("search_distance"), null);
  assert.deepEqual(applied, ["location"]);
});

test("special characters: é & quotes # survive encoding", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("query"), 'pokémon "black & white" #25');
});

// The URLs Kc opened and confirmed by eye on 2026-11-01 (plans/m1-plan.md).
test("golden URLs match Kc's by-eye checks 8, 9, 10", () => {
  const url = (input) =>
    craigslist.buildUrl(buildSearch({ words: "russell wilson foil card", ...input }), "asking").url;
  // Check 8 had no sort; the app adds sort=date (confirmed in check 9).
  assert.equal(url({}), "https://www.craigslist.org/search/sss?query=russell+wilson+foil+card&sort=date");
  const seattle = { exclude: "lot", priceMin: "5", priceMax: "50", location: { craigslistCity: "seattle" } };
  assert.equal(
    url({ ...seattle, condition: "used" }),
    "https://seattle.craigslist.org/search/sss?query=russell+wilson+foil+card+-lot&min_price=5&max_price=50&condition=20&condition=30&condition=40&condition=50&sort=date",
  );
  assert.equal(
    url({ ...seattle, condition: "new" }),
    "https://seattle.craigslist.org/search/sss?query=russell+wilson+foil+card+-lot&min_price=5&max_price=50&condition=10&sort=date",
  );
});
