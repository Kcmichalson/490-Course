import { test } from "node:test";
import assert from "node:assert/strict";
import poshmark from "../src/core/sites/poshmark.js";
import { buildSearch } from "../src/core/query.js";

const build = (input, view = "asking") => {
  const result = poshmark.buildUrl(buildSearch({ words: "star wars black series figure", ...input }), view);
  return { ...result, params: new URL(result.url).searchParams };
};

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://poshmark.com/search?"));
  assert.match(url, /query=star%20wars%20black%20series%20figure/);
  assert.equal(params.get("type"), "listings");
  assert.equal(params.get("availability"), null);
  assert.deepEqual([applied, skipped], [[], []]);
});

test("sold view", () => {
  assert.equal(build({}, "sold").params.get("availability"), "sold_out");
});

test("new = new with tags; used is skipped", () => {
  const isNew = build({ condition: "new" });
  assert.equal(isNew.params.get("condition"), "closet_nwt");
  assert.deepEqual(isNew.applied, ["condition"]);
  const used = build({ condition: "used" });
  assert.equal(used.params.get("condition"), null);
  assert.deepEqual(used.skipped, ["condition"]);
});

test("price range as price[]=min-max, or one end only", () => {
  const { url, params, applied } = build({ priceMin: "25", priceMax: "50" });
  assert.match(url, /&price%5B%5D=25-50/);
  assert.deepEqual(applied, ["price"]);
  assert.equal(build({ priceMin: "20" }).params.get("price[]"), "20-");
  assert.equal(build({ priceMax: "20" }).params.get("price[]"), "-20");
  assert.equal(build({}).params.get("price[]"), null);
  assert.equal(params.getAll("price[]").length, 1);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("query"), "pokémon black & white #25");
});

test("golden URLs match Kc's by-eye checks 14 and 15", () => {
  const words = "russell wilson foil card";
  assert.equal(
    build({ words }, "sold").url,
    "https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&availability=sold_out",
  );
  assert.equal(
    build({ words, condition: "new" }).url,
    "https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&condition=closet_nwt",
  );
  // Check 15's price URL had no type=listings (the site's default) and
  // availability=available; the app's asking link leaves both as default.
  assert.equal(
    build({ words, priceMin: "25", priceMax: "50" }).url,
    "https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&price%5B%5D=25-50",
  );
  // Check 24 a, b, c.
  for (const [input, range] of [
    [{ priceMin: "5", priceMax: "50" }, "5-50"],
    [{ priceMin: "20" }, "20-"],
    [{ priceMax: "20" }, "-20"],
  ]) {
    assert.equal(
      build({ words, ...input }).url,
      `https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&price%5B%5D=${range}`,
    );
  }
});
