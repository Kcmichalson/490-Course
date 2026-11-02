import { test } from "node:test";
import assert from "node:assert/strict";
import mercari from "../src/core/sites/mercari.js";
import { buildSearch } from "../src/core/query.js";

const build = (input, view = "asking") => {
  const result = mercari.buildUrl(buildSearch({ words: "star wars black series figure", ...input }), view);
  return { ...result, params: new URL(result.url).searchParams };
};

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://www.mercari.com/search/?"));
  assert.equal(params.get("keyword"), "star wars black series figure");
  assert.equal(params.get("sortBy"), "created_time");
  assert.equal(params.get("itemStatuses"), null);
  assert.deepEqual([applied, skipped], [[], []]);
});

test("exclusions are skipped, not added to the words", () => {
  const { params, skipped } = build({ exclude: "lot, broken" });
  assert.equal(params.get("keyword"), "star wars black series figure");
  assert.deepEqual(skipped, ["exclude"]);
});

test("price range", () => {
  const { params, applied } = build({ priceMin: "20", priceMax: "50" });
  assert.equal(params.get("priceMin"), "20");
  assert.equal(params.get("priceMax"), "50");
  assert.deepEqual(applied, ["price"]);
});

test("condition codes", () => {
  assert.equal(build({ condition: "new" }).params.get("itemConditions"), "1");
  assert.equal(build({ condition: "used" }).params.get("itemConditions"), "2,3,4,5");
  assert.equal(build({ condition: "any" }).params.get("itemConditions"), null);
});

test("buying format and location are skipped", () => {
  const { url, skipped } = build({ format: "auction", location: { zip: "98101" } });
  assert.deepEqual(skipped, ["format", "location"]);
  assert.ok(!url.includes("98101"));
});

test("sold view", () => {
  const { params } = build({}, "sold");
  assert.equal(params.get("itemStatuses"), "2-3");
  assert.equal(params.get("sortBy"), null);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("keyword"), "pokémon black & white #25");
});

// The URLs Kc opened and confirmed by eye on 2026-11-01 (plans/m1-plan.md).
// Kc's URLs wrote spaces as %20 and commas plain; the app writes + and %2C,
// which mean the same thing, so the decoded parts are compared.
test("golden URLs match Kc's by-eye checks 4 and 6", () => {
  const same = (actual, expected) => {
    const [a, e] = [new URL(actual), new URL(expected)];
    assert.equal(a.origin + a.pathname, e.origin + e.pathname);
    assert.deepEqual([...a.searchParams], [...e.searchParams]);
  };
  same(
    build({ words: "russell wilson foil card" }, "sold").url,
    "https://www.mercari.com/search/?keyword=russell%20wilson%20foil%20card&itemStatuses=2-3",
  );
  same(
    build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50", condition: "used" }).url,
    "https://www.mercari.com/search/?keyword=russell%20wilson%20foil%20card&priceMin=5&priceMax=50&itemConditions=2,3,4,5&sortBy=created_time",
  );
});
