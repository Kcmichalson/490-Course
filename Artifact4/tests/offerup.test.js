import { test } from "node:test";
import assert from "node:assert/strict";
import offerup from "../src/core/sites/offerup.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = offerup.buildUrl(buildSearch({ words: "mid century dresser", ...input }), "asking");
  return { ...result, params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(offerup.views, ["asking"]);
});

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://offerup.com/search?"));
  assert.equal(params.get("q"), "mid century dresser");
  assert.equal(params.get("sort"), "-posted");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("price range", () => {
  const { params, applied } = build({ priceMin: "50" });
  assert.equal(params.get("price_min"), "50");
  assert.equal(params.get("price_max"), null);
  assert.deepEqual(applied, ["price"]);
});

test("exclude, condition, format and location are skipped (no location in the URL, check 12)", () => {
  const { url, skipped } = build({
    exclude: "parts", condition: "used", format: "auction", location: { zip: "98101" },
  });
  assert.deepEqual(skipped, ["exclude", "condition", "format", "location"]);
  assert.ok(!url.includes("98101"));
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("q"), "pokémon black & white #25");
});

test("golden URL matches Kc's by-eye check 11", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50" });
  assert.equal(url, "https://offerup.com/search?q=russell+wilson+foil+card&price_min=5&price_max=50&sort=-posted");
});
