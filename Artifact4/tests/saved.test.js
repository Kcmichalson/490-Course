import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_MESSAGES, MAX_IMPORT_BYTES,
  addSearch, updateSearch, renameSearch, deleteSearch, filterSearches, summarizeInput,
  serializeSaved, parseSaved, exportText, exportFileName, parseImport, mergeImport, importMessage,
} from "../src/core/saved.js";
import { addPrice } from "../src/core/prices.js";

const IDS = ["ebay", "mercari", "craigslist"];
const T1 = "2026-11-03T10:00:00.000Z";
const T2 = "2026-11-03T11:00:00.000Z";
const T3 = "2026-11-03T12:00:00.000Z";

// What the sidebar and search bar hand over (sidebar.read() + words).
const form = (words, extra = {}) => ({
  words,
  priceMin: "",
  priceMax: "",
  condition: "any",
  format: "any",
  exclude: "",
  category: "other",
  storesOff: [],
  location: { zip: "", radius: "25", craigslistCity: "", facebookCity: "" },
  ...extra,
});

const add = (list, words, id, now, extra) => addSearch(list, form(words, extra), { id, now, siteIds: IDS });

function sample() {
  let list = add([], "russell wilson foil card", "s-1", T1, { category: "cards", priceMin: "5", priceMax: "50" });
  list = add(list, "star wars black series figure", "s-2", T2, { category: "toys", condition: "used" });
  return add(list, "mid century dresser", "s-3", T3, {
    category: "furniture", exclude: "parts, broken", storesOff: ["ebay", "mercari"],
    location: { zip: "98101", radius: "10", craigslistCity: "Seattle", facebookCity: "" },
  });
}

test("add: label is the words, times set, newest first", () => {
  const list = sample();
  assert.deepEqual(list.map((r) => r.id), ["s-3", "s-2", "s-1"]);
  const r = list[2];
  assert.equal(r.label, "russell wilson foil card");
  assert.equal(r.created, T1);
  assert.equal(r.updated, T1);
  assert.equal(r.input.priceMin, "5");
  assert.deepEqual(list[0].input.location, { zip: "98101", radius: 10, craigslistCity: "seattle", facebookCity: "" });
});

test("add: no words means nothing is saved; bad values are cleaned", () => {
  assert.deepEqual(add([], "   ", "s-1", T1), []);
  const [r] = add([], "lamp", "s-1", T1, { condition: "mint", format: 3, category: "boats", storesOff: ["ebay", "myspace"] });
  assert.deepEqual([r.input.condition, r.input.format, r.input.category, r.input.storesOff], ["any", "any", "other", ["ebay"]]);
});

test("update: new filters, same id, label and created time", () => {
  const list = renameSearch(sample(), "s-2", "Vader figure");
  const next = updateSearch(list, "s-2", form("star wars black series figure", { priceMax: "40" }), { now: T3, siteIds: IDS });
  const r = next.find((x) => x.id === "s-2");
  assert.deepEqual([r.label, r.created, r.updated, r.input.priceMax, r.input.condition], ["Vader figure", T2, T3, "40", "any"]);
  assert.deepEqual(next.map((x) => x.id), ["s-3", "s-2", "s-1"]);
  assert.equal(updateSearch(list, "s-2", form(""), { now: T3, siteIds: IDS }), list);
});

test("rename: trimmed; blank goes back to the words", () => {
  let list = renameSearch(sample(), "s-1", "  Wilson foil  ");
  assert.equal(list.find((r) => r.id === "s-1").label, "Wilson foil");
  list = renameSearch(list, "s-1", "   ");
  assert.equal(list.find((r) => r.id === "s-1").label, "russell wilson foil card");
});

test("delete: removes one; an unknown id changes nothing", () => {
  const list = sample();
  assert.deepEqual(deleteSearch(list, "s-2").map((r) => r.id), ["s-3", "s-1"]);
  assert.deepEqual(deleteSearch(list, "nope"), list);
  assert.equal(list.length, 3, "the original list is unchanged");
});

test("filter by text (label or words, any case) and by category", () => {
  const list = renameSearch(sample(), "s-2", "Vader figure");
  const ids = (opts) => filterSearches(list, opts).map((r) => r.id);
  assert.deepEqual(ids({ text: "WILSON" }), ["s-1"]);
  assert.deepEqual(ids({ text: "vader" }), ["s-2"]);
  assert.deepEqual(ids({ text: "black series" }), ["s-2"]);
  assert.deepEqual(ids({ category: "furniture" }), ["s-3"]);
  assert.deepEqual(ids({ text: "card", category: "toys" }), []);
  assert.deepEqual(ids({ text: "  ", category: "all" }), ["s-3", "s-2", "s-1"]);
  assert.deepEqual(ids({}), ["s-3", "s-2", "s-1"]);
});

test("summary line for a card", () => {
  const [furniture, toys, cards] = sample();
  assert.equal(summarizeInput(cards.input, 10), "$5–$50 · 10 stores");
  assert.equal(summarizeInput(toys.input, 10), "Used · 10 stores");
  assert.equal(summarizeInput(furniture.input, 10), "Not: parts, broken · Near 98101 · 8 stores");
  assert.equal(summarizeInput({ ...cards.input, priceMax: "", format: "buyNow", storesOff: ["ebay"] }, 2), "$5 and up · Buy now · 1 store");
});

test("browser storage round trip; garbage gives an empty list", () => {
  const list = sample();
  assert.deepEqual(parseSaved(serializeSaved(list), IDS), list);
  for (const bad of [null, "", "{nope", "[]", "42", '{"searches":"x"}']) {
    assert.deepEqual(parseSaved(bad, IDS), [], `input: ${bad}`);
  }
});

test("stored records: bad ones dropped, unknown stores dropped, duplicates once", () => {
  const good = sample()[0];
  const stored = JSON.stringify({
    version: 1,
    searches: [
      good,
      { ...good },                                    // duplicate id
      { ...good, id: "bad id!" },                     // bad id
      { ...good, id: "s-9", created: "yesterday" },   // bad time
      { ...good, id: "s-8", input: { ...good.input, words: "" } }, // no words
      { ...good, id: "s-7", input: { ...good.input, storesOff: ["ebay", "myspace"] }, label: "" },
      "not a record",
    ],
  });
  const list = parseSaved(stored, IDS);
  assert.deepEqual(list.map((r) => r.id), ["s-3", "s-7"]);
  assert.deepEqual(list[1].input.storesOff, ["ebay"]);
  assert.equal(list[1].label, "mid century dresser");
});

test("export, then import into an empty list: everything comes back", () => {
  const list = sample();
  const file = exportText(list, T3);
  assert.equal(JSON.parse(file).app, "price-check");
  assert.equal(exportFileName(new Date(2026, 10, 3, 23, 30)), "price-check-searches-2026-11-03.json");
  assert.equal(exportFileName(new Date(2027, 0, 5)), "price-check-searches-2027-01-05.json");
  const parsed = parseImport(file);
  assert.equal(parsed.ok, true);
  const merged = mergeImport([], parsed.searches, IDS);
  assert.deepEqual(merged.list, list);
  assert.equal(merged.message, "Imported 3 new searches.");
});

test("import: searches already saved are counted; nothing duplicated", () => {
  const list = sample();
  const { searches } = parseImport(exportText(list, T3));
  const partial = deleteSearch(list, "s-2");
  const merged = mergeImport(partial, searches, IDS);
  assert.deepEqual(merged.list.map((r) => r.id), ["s-3", "s-2", "s-1"]);
  assert.equal(merged.message, "Imported 1 new search; 2 already saved.");
  assert.equal(mergeImport(list, searches, IDS).message, "Nothing new to import; 3 already saved.");
});

test("import message wording (Kc's format)", () => {
  assert.equal(importMessage(2, 5, 3), "Imported 2 new searches and 5 new prices; 3 already saved.");
  assert.equal(importMessage(1, 1, 1), "Imported 1 new search and 1 new price; 1 already saved.");
  assert.equal(importMessage(0, 4, 2), "Imported 4 new prices; 2 already saved.");
  assert.equal(importMessage(3, 0, 0), "Imported 3 new searches.");
  assert.equal(importMessage(0, 0, 3), "Nothing new to import; 3 already saved.");
});

test("bad files are rejected with a clear message", () => {
  const cases = [
    ["{nope", IMPORT_MESSAGES.notJson],
    ["hello world", IMPORT_MESSAGES.notJson],
    ["", IMPORT_MESSAGES.notJson],
    ["[1,2,3]", IMPORT_MESSAGES.notExport],
    ['{"searches":[]}', IMPORT_MESSAGES.notExport],
    ['{"app":"other-app","version":1,"searches":[]}', IMPORT_MESSAGES.notExport],
    ['{"app":"price-check","version":1,"searches":"x"}', IMPORT_MESSAGES.notExport],
    ['{"app":"price-check","version":3,"searches":[]}', IMPORT_MESSAGES.newer],
    ['{"app":"price-check","searches":[]}', IMPORT_MESSAGES.newer],
    [" ".repeat(MAX_IMPORT_BYTES + 1), IMPORT_MESSAGES.tooLarge],
  ];
  for (const [file, message] of cases) {
    assert.deepEqual(parseImport(file), { ok: false, message }, file.slice(0, 40));
  }
});

test("a valid file with no usable searches changes nothing", () => {
  const list = sample();
  for (const searches of [[], [{ id: "x" }, "junk"]]) {
    const result = mergeImport(list, searches, IDS);
    assert.deepEqual(result, { ok: false, list, message: IMPORT_MESSAGES.empty });
  }
});

// A recorded price, as prices.js stores it.
const price = (id, extra = {}) => ({
  id, kind: "sold", siteId: "ebay", amount: 1250, shipping: 400, memberFree: null,
  date: "2026-11-01", note: "", created: T1, ...extra,
});

function withPrices() {
  let list = sample();
  list = addPrice(list, "s-1", price("p-1"));
  list = addPrice(list, "s-1", price("p-2", { kind: "asking", siteId: "mercari", shipping: null }));
  return addPrice(list, "s-3", price("p-3", { siteId: "craigslist", amount: 9000, shipping: 0 }));
}

test("new searches start with no prices; update and rename keep prices", () => {
  assert.ok(sample().every((r) => Array.isArray(r.prices) && r.prices.length === 0));
  let list = withPrices();
  list = updateSearch(list, "s-1", form("russell wilson foil card", { priceMax: "40" }), { now: T3, siteIds: IDS });
  list = renameSearch(list, "s-1", "Wilson");
  assert.deepEqual(list.find((r) => r.id === "s-1").prices.map((p) => p.id), ["p-1", "p-2"]);
});

test("prices survive browser storage and export/import", () => {
  const list = withPrices();
  assert.deepEqual(parseSaved(serializeSaved(list), IDS), list);
  const { searches } = parseImport(exportText(list, T3));
  assert.deepEqual(mergeImport([], searches, IDS).list, list);
  assert.equal(JSON.parse(exportText(list, T3)).version, 2);
});

test("a version 1 file (from M2, no prices) still imports", () => {
  const v1 = JSON.stringify({
    app: "price-check", version: 1, exported: T3,
    searches: sample().map(({ prices, ...rest }) => rest),
  });
  const parsed = parseImport(v1);
  assert.equal(parsed.ok, true);
  const merged = mergeImport([], parsed.searches, IDS);
  assert.equal(merged.list.length, 3);
  assert.ok(merged.list.every((r) => r.prices.length === 0));
  assert.equal(parseSaved(JSON.stringify({ version: 1, searches: JSON.parse(v1).searches }), IDS).length, 3);
});

test("bad prices are dropped; the search is kept", () => {
  const good = withPrices().find((r) => r.id === "s-1");
  const stored = JSON.stringify({
    version: 2,
    searches: [{
      ...good,
      prices: [
        ...good.prices,
        price("p-1"),                                  // duplicate id
        price("p-9", { amount: 0 }),                   // no amount
        price("p-8", { amount: 12.5 }),                // not whole cents
        price("p-7", { kind: "maybe" }),
        price("p-6", { siteId: "myspace" }),
        price("p-5", { date: "2026-02-30" }),
        price("p-4", { shipping: -100 }),
        "junk",
      ],
    }],
  });
  const [r] = parseSaved(stored, IDS);
  assert.equal(r.id, "s-1");
  assert.deepEqual(r.prices.map((p) => p.id), ["p-1", "p-2"]);
});

test("import merge: new prices added to a saved search, duplicates skipped, label and filters unchanged", () => {
  // At home: s-1 renamed and its max changed, with prices p-1 and p-2.
  let home = withPrices();
  home = renameSearch(home, "s-1", "Wilson (home)");
  home = updateSearch(home, "s-1", form("russell wilson foil card", { priceMax: "40", category: "cards" }), { now: T3, siteIds: IDS });
  const homeS1 = home.find((r) => r.id === "s-1");

  // The other browser's file: s-1 with p-1 (duplicate) plus p-10 and p-11,
  // its old label and filters; s-2 with p-12; and a new search s-4 with p-13.
  let other = withPrices();
  other = addPrice(other, "s-1", price("p-10", { date: "2026-11-02" }));
  other = addPrice(other, "s-1", price("p-11", { kind: "asking", siteId: "ebay" }));
  other = addPrice(other, "s-2", price("p-12", { siteId: "mercari" }));
  other = add(other, "pokemon base set charizard", "s-4", T3, { category: "cards" });
  other = addPrice(other, "s-4", price("p-13"));
  const { searches } = parseImport(exportText(other, T3));

  const merged = mergeImport(home, searches, IDS);
  const s1 = merged.list.find((r) => r.id === "s-1");
  assert.deepEqual(s1.prices.map((p) => p.id), ["p-1", "p-2", "p-10", "p-11"]);
  assert.equal(s1.label, "Wilson (home)");
  assert.deepEqual(s1.input, homeS1.input);
  assert.equal(s1.updated, homeS1.updated);
  assert.deepEqual(merged.list.find((r) => r.id === "s-2").prices.map((p) => p.id), ["p-12"]);
  assert.deepEqual(merged.list.find((r) => r.id === "s-3").prices.map((p) => p.id), ["p-3"]);
  assert.deepEqual(merged.list.find((r) => r.id === "s-4").prices.map((p) => p.id), ["p-13"]);
  assert.deepEqual(merged.counts, { searches: 1, prices: 4, already: 3 });
  assert.equal(merged.message, "Imported 1 new search and 4 new prices; 3 already saved.");

  // Importing the same file again adds nothing.
  const again = mergeImport(merged.list, searches, IDS);
  assert.deepEqual(again.list, merged.list);
  assert.equal(again.message, "Nothing new to import; 4 already saved.");
});

test("special characters survive export and import", () => {
  const list = add([], 'pokémon "black & white" #25', "s-1", T1, { exclude: "lot, réimpression" });
  const { searches } = parseImport(exportText(list, T1));
  const [r] = mergeImport([], searches, IDS).list;
  assert.equal(r.input.words, 'pokémon "black & white" #25');
  assert.equal(r.label, 'pokémon "black & white" #25');
  assert.equal(r.input.exclude, "lot, réimpression");
});
