import { test } from "node:test";
import assert from "node:assert/strict";
import { SITES, SITE_IDS, buildLinks } from "../src/core/sites/index.js";
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

test("buildLinks: sold group first, then asking, in SPEC order, only selected stores", () => {
  const search = buildSearch({ words: "russell wilson foil card", priceMax: "20" });
  const links = buildLinks(search, ["craigslist", "ebay", "mercari"]);
  assert.deepEqual(
    links.map((l) => `${l.view}:${l.siteId}`),
    ["sold:ebay", "sold:mercari", "asking:ebay", "asking:mercari", "asking:craigslist"],
  );
  assert.deepEqual(buildLinks(search, ["craigslist"]).map((l) => l.view), ["asking"]);
  assert.deepEqual(buildLinks(search, []), []);
});

test("buildLinks adds the filter text and notes", () => {
  const search = buildSearch({ words: "russell wilson foil card", exclude: "lot" });
  const links = buildLinks(search, ["ebay", "mercari", "craigslist"]);
  const find = (view, id) => links.find((l) => l.view === view && l.siteId === id);
  assert.equal(find("sold", "ebay").summary, "All filters");
  assert.equal(find("sold", "ebay").note, "Sign in to eBay to see sold prices");
  assert.equal(find("asking", "ebay").note, "");
  assert.equal(find("asking", "mercari").summary, "No filters applied (can't do exclude words)");
  assert.equal(find("asking", "craigslist").note, "No Craigslist city set (add one under Location)");
});
