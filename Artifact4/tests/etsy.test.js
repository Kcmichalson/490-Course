import { test } from "node:test";
import assert from "node:assert/strict";
import etsy from "../src/core/sites/etsy.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = etsy.buildUrl(buildSearch({ words: "star wars black series figure", ...input }), "asking");
  return { ...result, params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(etsy.views, ["asking"]);
});

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://www.etsy.com/search?"));
  assert.equal(params.get("q"), "star wars black series figure");
  assert.equal(params.get("order"), "most_recent");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("price range", () => {
  const { params, applied } = build({ priceMax: "20" });
  assert.equal(params.get("min"), null);
  assert.equal(params.get("max"), "20");
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

test("golden URL matches Kc's by-eye check 13", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50" });
  assert.equal(url, "https://www.etsy.com/search?q=russell+wilson+foil+card&min=5&max=50&order=most_recent");
});
