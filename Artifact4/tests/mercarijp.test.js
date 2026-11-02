import { test } from "node:test";
import assert from "node:assert/strict";
import mercarijp from "../src/core/sites/mercarijp.js";
import { buildSearch } from "../src/core/query.js";

const build = (input, view = "asking") => {
  const result = mercarijp.buildUrl(buildSearch({ words: "pokemon card", ...input }), view);
  return { ...result, params: new URL(result.url).searchParams };
};

test("current listings: words as typed, on sale, newest first (check 36)", () => {
  const { url, params, applied, skipped } = build({});
  assert.equal(url, "https://jp.mercari.com/search?keyword=pokemon+card&status=on_sale&sort=created_time&order=desc");
  assert.equal(params.get("keyword"), "pokemon card");
  assert.deepEqual([applied, skipped], [[], []]);
});

test("sold listings: status=sold_out (check 37)", () => {
  assert.equal(build({}, "sold").params.get("status"), "sold_out");
});

test("Japanese words, like Kc's example, survive encoding", () => {
  const { params } = build({ words: "純銅インゴット1.01kg" });
  assert.equal(params.get("keyword"), "純銅インゴット1.01kg");
});

test("leave-outs, price, condition, format and location are skipped", () => {
  const { url, skipped } = build({
    words: '"black series" vader -lot', priceMin: "5", priceMax: "50",
    condition: "used", format: "auction", location: { zip: "98101" },
  });
  assert.deepEqual(skipped, ["exclude", "price", "condition", "format", "location"]);
  assert.equal(new URL(url).searchParams.get("keyword"), "black series vader");
  assert.ok(!url.includes("price"));
});

test("both views carry the Japanese-site note", () => {
  assert.match(mercarijp.notes.asking, /Japanese site/);
  assert.match(mercarijp.notes.sold, /Japanese site/);
});

// The URLs Kc opened and confirmed by eye on 2026-11-01.
test("golden URLs match Kc's by-eye checks 36 and 37", () => {
  assert.equal(build({}).url,
    "https://jp.mercari.com/search?keyword=pokemon+card&status=on_sale&sort=created_time&order=desc");
  assert.equal(build({}, "sold").url,
    "https://jp.mercari.com/search?keyword=pokemon+card&status=sold_out&sort=created_time&order=desc");
});
