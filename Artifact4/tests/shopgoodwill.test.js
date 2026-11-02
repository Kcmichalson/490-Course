import { test } from "node:test";
import assert from "node:assert/strict";
import shopgoodwill from "../src/core/sites/shopgoodwill.js";
import { buildSearch } from "../src/core/query.js";

const TODAY = new Date(2026, 10, 1); // 1 Nov 2026, local time

const build = (input, view = "asking") => {
  const search = buildSearch({ words: "star wars black series figure", ...input });
  const result = shopgoodwill.buildUrl(search, view, TODAY);
  return { ...result, params: new URL(result.url).searchParams };
};

test("sold (closed auctions) and asking views", () => {
  assert.deepEqual(shopgoodwill.views, ["sold", "asking"]);
  const asking = build({}).params;
  assert.equal(asking.get("sca"), "false");
  assert.equal(build({}, "sold").params.get("sca"), "true");
});

test("sold view: closed auctions ending today, 30 days back", () => {
  const { url, params } = build({}, "sold");
  assert.equal(params.get("lp"), "0");
  assert.equal(params.get("hp"), "999999");
  assert.equal(params.get("sca"), "true");
  assert.equal(params.get("caed"), "11/1/2026");
  assert.equal(params.get("cadb"), "30");
  assert.match(url, /caed=11%2F1%2F2026/);
  const march = shopgoodwill.buildUrl(buildSearch({ words: "x" }), "sold", new Date(2027, 2, 9));
  assert.equal(new URL(march.url).searchParams.get("caed"), "3/9/2027");
});

// Check 32: Kc's own manual search for "Lamp" on ShopGoodwill. The short
// links (checks 29, 31) stalled with no price.
test("golden asking URL with no price matches Kc's manual search (check 32)", () => {
  const { url, applied, skipped } = build({ words: "Lamp" });
  assert.equal(
    url,
    "https://shopgoodwill.com/categories/listing?st=Lamp&sg=&c=&s=&lp=0&hp=999999&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=false&caed=11%2F1%2F2026&cadb=7&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=false&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=true",
  );
  assert.deepEqual([applied, skipped], [[], []]);
});

test("price range: both ends use the short form; one end uses the full form", () => {
  const both = build({ priceMin: "5", priceMax: "50" });
  assert.deepEqual([...both.params.keys()], ["st", "lp", "hp"]);
  assert.deepEqual(both.applied, ["price"]);
  const minOnly = build({ priceMin: "5" }).params;
  assert.deepEqual([minOnly.get("lp"), minOnly.get("hp"), minOnly.get("sca")], ["5", "999999", "false"]);
  const maxOnly = build({ priceMax: "20" }).params;
  assert.deepEqual([maxOnly.get("lp"), maxOnly.get("hp")], ["0", "20"]);
});

test("exclude, condition, format and location are skipped", () => {
  const { skipped } = build({
    exclude: "lot", condition: "used", format: "auction", location: { zip: "98101" },
  });
  assert.deepEqual(skipped, ["exclude", "condition", "format", "location"]);
});

test("special characters: é & # survive, quotes are stripped", () => {
  const { params } = build({ words: 'pokémon "black & white" #25' });
  assert.equal(params.get("st"), "pokémon black & white #25");
});

test("golden URL matches Kc's by-eye check 16", () => {
  const { url } = build({ words: "russell wilson foil card", priceMin: "5", priceMax: "50" });
  assert.equal(url, "https://shopgoodwill.com/categories/listing?st=russell%20wilson%20foil%20card&lp=5&hp=50");
});

// Check 25c: check 17's full URL with st=lamp worked; the short form
// (25b) didn't, so the app builds the full form.
test("golden sold URL matches Kc's by-eye check 25c", () => {
  const { url } = build({ words: "lamp", priceMin: "5", priceMax: "50" }, "sold");
  assert.equal(
    url,
    "https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=5&hp=50&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=",
  );
});

// Check 28c: with no price, only lp=0&hp=999999 kept the words and the
// closed filter (empty lp/hp in 28b, or none in 28d, dropped them).
test("golden sold URL with no price matches Kc's by-eye check 28c", () => {
  const { url } = build({ words: "lamp" }, "sold");
  assert.equal(
    url,
    "https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=0&hp=999999&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=",
  );
  const minOnly = new URL(build({ words: "lamp", priceMin: "20" }, "sold").url).searchParams;
  assert.deepEqual([minOnly.get("lp"), minOnly.get("hp")], ["20", "999999"]);
  const maxOnly = new URL(build({ words: "lamp", priceMax: "20" }, "sold").url).searchParams;
  assert.deepEqual([maxOnly.get("lp"), maxOnly.get("hp")], ["0", "20"]);
});
