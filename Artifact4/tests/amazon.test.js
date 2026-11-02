import { test } from "node:test";
import assert from "node:assert/strict";
import amazon from "../src/core/sites/amazon.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = amazon.buildUrl(buildSearch({ words: "star wars black series figure", ...input }), "asking");
  return { ...result, params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(amazon.views, ["asking"]);
});

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://www.amazon.com/s?"));
  assert.equal(params.get("k"), "star wars black series figure");
  assert.equal(params.get("rh"), null);
  assert.equal(params.get("s"), "date-desc-rank");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("price in cents, both ends or one (one end: check 23)", () => {
  assert.equal(build({ priceMin: "5", priceMax: "50" }).params.get("rh"), "p_36:500-5000");
  assert.equal(build({ priceMin: "20" }).params.get("rh"), "p_36:2000-");
  assert.equal(build({ priceMax: "20" }).params.get("rh"), "p_36:-2000");
});

test("exclude, condition, format and location are skipped", () => {
  const { skipped } = build({
    exclude: "lot", condition: "new", format: "buyNow", location: { zip: "98101" },
  });
  assert.deepEqual(skipped, ["exclude", "condition", "format", "location"]);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("k"), "pokémon black & white #25");
});

test("golden URLs match Kc's by-eye checks 18, 23 and 27", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50" });
  assert.equal(url, "https://www.amazon.com/s?k=russell+wilson+foil+card&rh=p_36%3A500-5000&s=date-desc-rank");
  assert.equal(
    build({ priceMin: "20" }).url,
    "https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_36%3A2000-&s=date-desc-rank",
  );
  assert.equal(
    build({ priceMax: "20" }).url,
    "https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_36%3A-2000&s=date-desc-rank",
  );
});
