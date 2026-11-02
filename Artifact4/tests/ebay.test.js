import { test } from "node:test";
import assert from "node:assert/strict";
import ebay from "../src/core/sites/ebay.js";
import { buildSearch } from "../src/core/query.js";

const build = (input, view = "asking") => {
  const result = ebay.buildUrl(buildSearch({ words: "russell wilson foil card", ...input }), view);
  return { ...result, params: new URL(result.url).searchParams };
};

test("plain words", () => {
  const { url, params, applied, skipped } = build({});
  assert.ok(url.startsWith("https://www.ebay.com/sch/i.html?"));
  assert.equal(params.get("_nkw"), "russell wilson foil card");
  assert.equal(params.get("_sop"), "10");
  assert.equal(params.get("LH_Sold"), null);
  assert.deepEqual([applied, skipped], [[], []]);
});

test("exclusions become -words in the search", () => {
  const { params, applied } = build({ exclude: "lot, reprint" });
  assert.equal(params.get("_nkw"), "russell wilson foil card -lot -reprint");
  assert.deepEqual(applied, ["exclude"]);
});

test("leave-outs from either box; a phrase is -\"…\" (check 35)", () => {
  const { url, params } = build({ words: "pokemon card -promo", exclude: "base set" });
  assert.equal(params.get("_nkw"), 'pokemon card -promo -"base set"');
  assert.equal(url, "https://www.ebay.com/sch/i.html?_nkw=pokemon+card+-promo+-%22base+set%22&_sop=10");
});

test("price range, and only one end", () => {
  let { params } = build({ priceMin: "5", priceMax: "50" });
  assert.equal(params.get("_udlo"), "5");
  assert.equal(params.get("_udhi"), "50");
  ({ params } = build({ priceMax: "20" }));
  assert.equal(params.get("_udlo"), null);
  assert.equal(params.get("_udhi"), "20");
});

test("condition codes", () => {
  assert.equal(build({ condition: "new" }).params.get("LH_ItemCondition"), "1000|1500");
  assert.equal(build({ condition: "used" }).params.get("LH_ItemCondition"), "3000|2750|4000");
  assert.equal(build({ condition: "any" }).params.get("LH_ItemCondition"), null);
  assert.match(build({ condition: "used" }).url, /LH_ItemCondition=3000%7C2750%7C4000/);
});

test("buying format", () => {
  const auction = build({ format: "auction" }).params;
  assert.equal(auction.get("LH_Auction"), "1");
  assert.equal(auction.get("LH_BIN"), null);
  const buyNow = build({ format: "buyNow" }).params;
  assert.equal(buyNow.get("LH_BIN"), "1");
  assert.equal(buyNow.get("LH_Auction"), null);
});

test("location: ZIP and radius", () => {
  const { params, applied } = build({ location: { zip: "98101", radius: "50" } });
  assert.equal(params.get("_stpos"), "98101");
  assert.equal(params.get("_sadis"), "50");
  assert.equal(params.get("_fspt"), "1");
  assert.equal(params.get("LH_PrefLoc"), null);
  assert.deepEqual(applied, ["location"]);
});

test("a city alone is skipped (eBay needs a ZIP)", () => {
  const { params, skipped } = build({ location: { craigslistCity: "seattle" } });
  assert.equal(params.get("_stpos"), null);
  assert.deepEqual(skipped, ["location"]);
});

test("sold view", () => {
  const { params } = build({}, "sold");
  assert.equal(params.get("LH_Sold"), "1");
  assert.equal(params.get("LH_Complete"), "1");
  assert.equal(params.get("_sop"), "13");
});

test("special characters: é & quotes # survive encoding", () => {
  const { url, params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("_nkw"), 'pokémon "black & white" #25');
  assert.ok(url.includes("_nkw=pok%C3%A9mon+%22black+%26+white%22+%2325"), url);
  assert.equal(new URL(url).hash, "");
});

// The URLs Kc opened and confirmed by eye on 2026-11-01 (plans/m1-plan.md).
test("golden URLs match Kc's by-eye checks 1, 2, 20, 21", () => {
  const url = (words, input, view = "asking") =>
    ebay.buildUrl(buildSearch({ words, ...input }), view).url;
  assert.equal(
    url("russell wilson foil card", {}, "sold"),
    "https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card&LH_Sold=1&LH_Complete=1&_sop=13",
  );
  assert.equal(
    url("russell wilson foil card", {
      exclude: "lot, reprint", priceMin: "5", priceMax: "50", condition: "used", format: "buyNow",
    }),
    "https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card+-lot+-reprint&_udlo=5&_udhi=50&LH_ItemCondition=3000%7C2750%7C4000&LH_BIN=1&_sop=10",
  );
  // Check 20 had no sort; the app adds _sop=10 (confirmed in check 2).
  assert.equal(
    url('pokémon "black & white" #25', {}),
    "https://www.ebay.com/sch/i.html?_nkw=pok%C3%A9mon+%22black+%26+white%22+%2325&_sop=10",
  );
  assert.equal(
    url("mid century dresser", { condition: "used" }),
    "https://www.ebay.com/sch/i.html?_nkw=mid+century+dresser&LH_ItemCondition=3000%7C2750%7C4000&_sop=10",
  );
});

// Check 3's URL used Kc's own ZIP, which isn't kept in the repo; this test
// uses 98101 with the same params eBay wrote. Kc opened this exact URL in
// check 26.
test("location URL matches Kc's by-eye checks 3 and 26", () => {
  const { url } = build({ location: { zip: "98101", radius: "25" } });
  assert.equal(
    url,
    "https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card&_stpos=98101&_sadis=25&_fspt=1&_sop=10",
  );
});
