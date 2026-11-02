import { test } from "node:test";
import assert from "node:assert/strict";
import { SITES, SITE_IDS, buildLinks, storesWithoutView } from "../src/core/sites/index.js";
import { buildSearch, FILTER_KEYS } from "../src/core/query.js";

const SPEC_ORDER = [
  "ebay", "mercari", "facebook", "craigslist", "offerup",
  "etsy", "poshmark", "shopgoodwill", "amazon", "walmart",
];

const HOSTS = {
  ebay: /^www\.ebay\.com$/,
  mercari: /^www\.mercari\.com$/,
  craigslist: /^[a-z0-9]+\.craigslist\.org$/,
  facebook: /^www\.facebook\.com$/,
  offerup: /^offerup\.com$/,
  etsy: /^www\.etsy\.com$/,
  poshmark: /^poshmark\.com$/,
  shopgoodwill: /^shopgoodwill\.com$/,
  amazon: /^www\.amazon\.com$/,
  walmart: /^www\.walmart\.com$/,
};

test("exactly the ten SPEC section 5 adapters, in order", () => {
  assert.deepEqual(SITE_IDS, SPEC_ORDER);
});

test("each adapter declares its contract", () => {
  for (const site of SITES) {
    assert.equal(typeof site.name, "string", site.id);
    assert.ok(site.lastChecked === null || /^\d{4}-\d{2}-\d{2}$/.test(site.lastChecked), site.id);
    assert.ok(site.views.length > 0 && site.views.every((v) => v === "sold" || v === "asking"), site.id);
    assert.ok(Array.isArray(site.unconfirmed), site.id);
    for (const note of site.unconfirmed) assert.match(note, /\(checks? [\d, ]+\)$/, `${site.id}: ${note}`);
    assert.equal(typeof site.buildUrl, "function", site.id);
  }
});

test("empty and full searches build https links on the right host", () => {
  const searches = [
    buildSearch({}),
    buildSearch({
      words: 'pokémon "black & white" #25',
      exclude: "lot",
      priceMin: "5",
      priceMax: "50",
      condition: "used",
      format: "auction",
      location: { zip: "98101", radius: "10", craigslistCity: "seattle", facebookCity: "seattle" },
    }),
  ];
  for (const search of searches) {
    for (const site of SITES) {
      for (const view of site.views) {
        const { url, applied, skipped } = site.buildUrl(search, view, new Date("2026-11-01T12:00:00"));
        const parsed = new URL(url);
        assert.equal(parsed.protocol, "https:", `${site.id} ${view}`);
        assert.match(parsed.hostname, HOSTS[site.id], `${site.id} ${view}`);
        assert.ok(Array.isArray(applied) && Array.isArray(skipped));
      }
    }
  }
});

// One filter at a time: a filter lands in "applied" exactly when the
// adapter's `supports` says the site can do it.
test("supports matches what buildUrl applies", () => {
  const one = {
    exclude: { exclude: "lot" },
    price: { priceMin: "5", priceMax: "50" },
    condition: { condition: "used" },
    format: { format: "auction" },
    location: { location: { zip: "98101", craigslistCity: "seattle", facebookCity: "seattle" } },
  };
  for (const site of SITES) {
    for (const key of FILTER_KEYS) {
      const search = buildSearch({ words: "mid century dresser", ...one[key] });
      const expected = key === "format" ? site.supports.format.includes("auction")
        : key === "condition" ? site.supports.condition.includes("used")
          : Boolean(site.supports[key]);
      for (const view of site.views) {
        const { applied, skipped } = site.buildUrl(search, view, new Date());
        assert.deepEqual(applied, expected ? [key] : [], `${site.id} ${view} ${key} applied`);
        assert.deepEqual(skipped, expected ? [] : [key], `${site.id} ${view} ${key} skipped`);
      }
    }
  }
});

// Retrofit: one view at a time (Current or Sold) instead of both groups.
test("buildLinks: current listings for every selected store, in SPEC order", () => {
  const search = buildSearch({ words: "russell wilson foil card", priceMax: "20" });
  const all = buildLinks(search, SITE_IDS, new Date(), "asking");
  assert.deepEqual(all.map((l) => l.siteId), SPEC_ORDER);
  assert.ok(all.every((l) => l.view === "asking"));
  const some = buildLinks(search, ["craigslist", "ebay", "mercari"], new Date(), "asking");
  assert.deepEqual(some.map((l) => l.siteId), ["ebay", "mercari", "craigslist"]);
  assert.deepEqual(buildLinks(search, [], new Date(), "asking"), []);
});

test("buildLinks: sold listings only for stores with a sold view", () => {
  const search = buildSearch({ words: "russell wilson foil card" });
  const sold = buildLinks(search, SITE_IDS, new Date(), "sold");
  assert.deepEqual(sold.map((l) => l.siteId), ["ebay", "mercari", "poshmark", "shopgoodwill"]);
  assert.ok(sold.every((l) => l.view === "sold"));
  assert.deepEqual(storesWithoutView(SITE_IDS, "sold"),
    ["Facebook Marketplace", "Craigslist", "OfferUp", "Etsy", "Amazon", "Walmart"]);
  assert.deepEqual(storesWithoutView(["ebay", "craigslist"], "sold"), ["Craigslist"]);
  assert.deepEqual(storesWithoutView(SITE_IDS, "asking"), []);
});

test("buildLinks: no view or an unknown view means current listings", () => {
  const search = buildSearch({ words: "lamp" });
  const ids = (view) => buildLinks(search, ["ebay", "craigslist"], new Date(), view).map((l) => `${l.view}:${l.siteId}`);
  assert.deepEqual(ids(undefined), ["asking:ebay", "asking:craigslist"]);
  assert.deepEqual(ids("bought"), ["asking:ebay", "asking:craigslist"]);
});

test("buildLinks adds the filter text and notes", () => {
  const search = buildSearch({ words: "russell wilson foil card", exclude: "lot" });
  const find = (view, id) => buildLinks(search, ["ebay", "mercari", "craigslist"], new Date(), view)
    .find((l) => l.siteId === id);
  assert.equal(find("sold", "ebay").summary, "All filters");
  assert.deepEqual(find("sold", "ebay").notes, ["Sign in to eBay to see sold prices"]);
  assert.deepEqual(find("asking", "ebay").notes, []);
  assert.equal(find("asking", "mercari").summary, "No filters applied (can't do exclude words)");
  assert.deepEqual(find("asking", "craigslist").notes, ["No Craigslist city set (add one under Location)"]);
});
