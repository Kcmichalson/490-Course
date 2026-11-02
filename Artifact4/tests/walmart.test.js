import { test } from "node:test";
import assert from "node:assert/strict";
import walmart from "../src/core/sites/walmart.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = walmart.buildUrl(buildSearch({ words: "star wars black series figure", ...input }), "asking");
  return { ...result, params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(walmart.views, ["asking"]);
});

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://www.walmart.com/search?"));
  assert.equal(params.get("q"), "star wars black series figure");
  assert.equal(params.get("sort"), "new");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("price range", () => {
  const { params, applied } = build({ priceMin: "20", priceMax: "50" });
  assert.equal(params.get("min_price"), "20");
  assert.equal(params.get("max_price"), "50");
  assert.deepEqual(applied, ["price"]);
});

test("exclude, condition, format and location are skipped", () => {
  const { skipped } = build({
    exclude: "lot", condition: "new", format: "buyNow", location: { zip: "98101" },
  });
  assert.deepEqual(skipped, ["exclude", "condition", "format", "location"]);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("q"), "pokémon black & white #25");
});

test("golden URL matches Kc's by-eye check 19", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50" });
  assert.equal(url, "https://www.walmart.com/search?q=russell+wilson+foil+card&min_price=5&max_price=50&sort=new");
});
