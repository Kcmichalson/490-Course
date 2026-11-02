import { test } from "node:test";
import assert from "node:assert/strict";
import facebook from "../src/core/sites/facebook.js";
import { buildSearch } from "../src/core/query.js";

const build = (input) => {
  const result = facebook.buildUrl(buildSearch({ words: "mid century dresser", ...input }), "asking");
  return { ...result, parsed: new URL(result.url), params: new URL(result.url).searchParams };
};

test("asking view only", () => {
  assert.deepEqual(facebook.views, ["asking"]);
});

test("plain words, no city: account location and a note", () => {
  const { parsed, params, note, applied, skipped } = build({});
  assert.equal(parsed.origin + parsed.pathname, "https://www.facebook.com/marketplace/search/");
  assert.equal(params.get("query"), "mid century dresser");
  assert.equal(params.get("sortBy"), "creation_time_descend");
  assert.equal(note, "No Facebook city set, so Facebook uses your account's location");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("spaces are %20 and commas plain, as in Kc's confirmed URL", () => {
  const { url } = build({ condition: "used" });
  assert.match(url, /query=mid%20century%20dresser/);
  assert.match(url, /itemCondition=used_like_new,used_good,used_fair/);
});

test("exclusions are skipped and quotes stripped", () => {
  const { params, skipped } = build({ words: '"mid century" dresser', exclude: "parts" });
  assert.equal(params.get("query"), "mid century dresser");
  assert.deepEqual(skipped, ["exclude"]);
});

test("price range and condition", () => {
  const { params, applied } = build({ priceMin: "50", priceMax: "300", condition: "new" });
  assert.equal(params.get("minPrice"), "50");
  assert.equal(params.get("maxPrice"), "300");
  assert.equal(params.get("itemCondition"), "new");
  assert.deepEqual(applied, ["price", "condition"]);
});

test("city goes in the path (check 22); a ZIP alone is skipped", () => {
  const withCity = build({ location: { facebookCity: "Seattle" } });
  assert.equal(withCity.parsed.pathname, "/marketplace/seattle/search/");
  assert.equal(withCity.note, undefined);
  assert.deepEqual(withCity.applied, ["location"]);
  assert.deepEqual(build({ location: { zip: "98101" } }).skipped, ["location"]);
});

test("buying format is skipped", () => {
  assert.deepEqual(build({ format: "auction" }).skipped, ["format"]);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("query"), "pokémon black & white #25");
});

test("golden URLs match Kc's by-eye checks 7 and 22", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50", condition: "used" });
  assert.equal(
    url,
    "https://www.facebook.com/marketplace/search/?query=russell%20wilson%20foil%20card&minPrice=5&maxPrice=50&itemCondition=used_like_new,used_good,used_fair&sortBy=creation_time_descend",
  );
  assert.equal(
    build({ condition: "new", location: { facebookCity: "seattle" } }).url,
    "https://www.facebook.com/marketplace/seattle/search/?query=mid%20century%20dresser&itemCondition=new&sortBy=creation_time_descend",
  );
});
