import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeShare, decodeShare, linkSettings } from "../src/core/share.js";
import { SITE_IDS } from "../src/core/sites/index.js";

const full = {
  words: 'pokémon "black & white" #25 -reprint',
  exclude: "lot, base set",
  view: "sold",
  storesOn: ["ebay", "mercari", "craigslist"],
  priceMin: "$5",
  priceMax: "50",
  condition: "used",
  format: "buyNow",
  location: { zip: "98101", radius: "10", craigslistCity: "Seattle, WA", facebookCity: "seattle" },
};

test("round trip: everything but location by default", () => {
  const hash = encodeShare(full);
  assert.ok(hash.startsWith("#q="));
  assert.deepEqual(decodeShare(hash, SITE_IDS), {
    words: 'pokémon "black & white" #25 -reprint',
    exclude: "lot, base set",
    view: "sold",
    storesOn: ["ebay", "mercari", "craigslist"],
    priceMin: "5",
    priceMax: "50",
    condition: "used",
    format: "buyNow",
  });
});

test("special characters are encoded, so # and & can't break the link", () => {
  const hash = encodeShare(full);
  assert.equal(hash.slice(1).includes("#"), false);
  assert.match(hash, /pok%C3%A9mon/);
  assert.match(hash, /%26/); // the & in "black & white"
  const curly = decodeShare(encodeShare({ words: "“black series” vader", storesOn: ["ebay"] }), SITE_IDS);
  assert.equal(curly.words, "“black series” vader");
});

test("location only with Include my location", () => {
  assert.equal(/[#&](z|r|cl|fb)=/.test(encodeShare(full)), false);
  const hash = encodeShare(full, { includeLocation: true });
  assert.deepEqual(decodeShare(hash, SITE_IDS).location,
    { zip: "98101", radius: 10, craigslistCity: "seattle", facebookCity: "seattle" });
  // The default radius (25) is left out to keep links short.
  const short = encodeShare({ ...full, location: { zip: "98101", radius: 25 } }, { includeLocation: true });
  assert.equal(/[#&]r=/.test(short), false);
});

test("short links: filters at their default are left out", () => {
  const hash = encodeShare({
    words: "lamp", exclude: "", view: "asking", storesOn: ["ebay", "facebook", "mercari"],
    priceMin: "", priceMax: "", condition: "any", format: "any",
  });
  assert.equal(hash, "#q=lamp&st=ebay,facebook,mercari");
  assert.deepEqual(decodeShare(hash, SITE_IDS), { words: "lamp", storesOn: ["ebay", "facebook", "mercari"] });
});

test("no search words: nothing to share", () => {
  assert.equal(encodeShare({ words: "   ", storesOn: ["ebay"] }), "");
  assert.equal(encodeShare({}), "");
});

test("opening a link: settings it leaves out go to their default; location stays the visitor's", () => {
  // A sender on Current with no filters: the link has only q and st.
  const link = decodeShare("#q=mcm%20dresser&st=craigslist,offerup", SITE_IDS);
  assert.deepEqual(linkSettings(link, SITE_IDS), {
    words: "mcm dresser",
    exclude: "",
    view: "asking",
    storesOn: ["craigslist", "offerup"],
    priceMin: "",
    priceMax: "",
    condition: "any",
    format: "any",
  });
  // No st (a hand-made link): the default stores.
  assert.deepEqual(linkSettings(decodeShare("#q=lamp", SITE_IDS), SITE_IDS).storesOn, ["ebay", "mercari", "facebook"]);
  // What the link carries wins.
  const full = linkSettings(decodeShare(encodeShare({
    words: "lamp", view: "sold", storesOn: ["ebay"], condition: "new", location: { zip: "98101" },
  }, { includeLocation: true }), SITE_IDS), SITE_IDS);
  assert.deepEqual([full.view, full.condition, full.location], ["sold", "new", { zip: "98101" }]);
  // No search words: the link sets nothing.
  assert.deepEqual(linkSettings(decodeShare("#st=ebay&c=n", SITE_IDS), SITE_IDS), {});
});

test("partial links fill in only what they carry", () => {
  assert.deepEqual(decodeShare("#q=lamp", SITE_IDS), { words: "lamp" });
  assert.deepEqual(decodeShare("q=lamp&c=n", SITE_IDS), { words: "lamp", condition: "new" });
});

test("garbage never throws and falls back safely", () => {
  const cases = [
    ["", {}],
    ["#", {}],
    ["#%%%", {}],
    ["#q", {}],
    ["#st=myspace,ebay,ebay", { storesOn: ["ebay"] }],
    ["#st=myspace", {}],
    ["#lo=abc&hi=-5", {}],
    ["#lo=60&hi=50", { priceMin: "50", priceMax: "60" }],
    ["#c=x&f=zz&v=maybe", { view: "asking" }],
    ["#z=abc&r=9999&cl=!!!", {}],
    [null, {}],
  ];
  for (const [hash, expected] of cases) {
    assert.deepEqual(decodeShare(hash, SITE_IDS), expected, String(hash));
  }
  const huge = decodeShare(`#q=${"a".repeat(10_000)}`, SITE_IDS);
  assert.equal(huge.words.length, 500);
  // A broken escape decodes to some text (the decoder substitutes a
  // replacement character) rather than throwing.
  const broken = decodeShare("#q=%E0%A4%A&st=ebay", SITE_IDS);
  assert.equal(typeof broken.words, "string");
  assert.deepEqual(broken.storesOn, ["ebay"]);
});
