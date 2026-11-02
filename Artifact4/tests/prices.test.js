import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICE_MESSAGES, SORT_MODES,
  parseMoney, formatMoney, isDay, localDay, formatDay, membershipFor,
  priceFromForm, addPrice, deletePrice, totalCents, describePrice,
  latestPrice, lastChecked, pricesNewestFirst, sortSearches,
} from "../src/core/prices.js";

const IDS = ["ebay", "mercari", "amazon", "walmart"];
const NOW = "2026-11-03T12:00:00.000Z";

const form = (extra = {}) => ({
  kind: "sold", siteId: "ebay", amount: "12.50", shipping: "4", memberFree: false,
  date: "2026-11-01", note: "", ...extra,
});
const make = (id, extra, created = NOW) => {
  const result = priceFromForm(form(extra), { id, now: created, siteIds: IDS });
  assert.ok(result.ok, result.message);
  return result.price;
};

test("parseMoney: dollars to whole cents", () => {
  const cases = [
    ["12.50", 1250], ["$12.5", 1250], ["12", 1200], [".99", 99], ["1,250.05", 125005],
    [" $7 ", 700], ["0", 0], ["1000000", 100_000_000], [19.99, 1999],
  ];
  for (const [text, cents] of cases) assert.equal(parseMoney(text), cents, String(text));
  for (const bad of ["", "  ", "abc", "-5", "12.345", "1.2.3", "$", "1000000.01", null, undefined, {}]) {
    assert.equal(parseMoney(bad), null, String(bad));
  }
});

test("formatMoney, dates", () => {
  assert.equal(formatMoney(1250), "$12.50");
  assert.equal(formatMoney(125005), "$1,250.05");
  assert.equal(formatMoney(0), "$0.00");
  assert.ok(isDay("2026-11-01") && isDay("2028-02-29"));
  for (const bad of ["2026-02-30", "2026-13-01", "11/1/2026", "", null]) assert.ok(!isDay(bad), String(bad));
  assert.equal(localDay(new Date(2026, 10, 1, 23, 30)), "2026-11-01");
  const today = new Date(2026, 10, 3);
  assert.equal(formatDay("2026-11-01", today), "Nov 1");
  assert.equal(formatDay("2025-12-24", today), "Dec 24, 2025");
});

test("a price from the form: cents, shipping, note", () => {
  const p = make("p-1", { note: "  graded  " });
  assert.deepEqual(p, {
    id: "p-1", kind: "sold", siteId: "ebay", amount: 1250, shipping: 400, memberFree: null,
    date: "2026-11-01", note: "graded", created: NOW,
  });
  assert.equal(make("p-2", { shipping: "" }).shipping, null);
  assert.equal(make("p-3", { shipping: "0" }).shipping, 0);
  assert.equal(make("p-4", { siteId: "other" }).siteId, "other");
});

test("a bad form gives a clear message", () => {
  const bad = (extra) => priceFromForm(form(extra), { id: "p-1", now: NOW, siteIds: IDS });
  assert.deepEqual(bad({ amount: "" }), { ok: false, message: PRICE_MESSAGES.amount });
  assert.deepEqual(bad({ amount: "0" }), { ok: false, message: PRICE_MESSAGES.amount });
  assert.deepEqual(bad({ amount: "twelve" }), { ok: false, message: PRICE_MESSAGES.amount });
  assert.deepEqual(bad({ shipping: "free" }), { ok: false, message: PRICE_MESSAGES.shipping });
  assert.deepEqual(bad({ kind: "" }), { ok: false, message: PRICE_MESSAGES.kind });
  assert.deepEqual(bad({ siteId: "myspace" }), { ok: false, message: PRICE_MESSAGES.site });
  assert.deepEqual(bad({ date: "" }), { ok: false, message: PRICE_MESSAGES.date });
});

test("membership free shipping applies only on its own store", () => {
  assert.equal(membershipFor("amazon").id, "prime");
  assert.equal(membershipFor("walmart").id, "walmartplus");
  assert.equal(membershipFor("ebay"), null);
  assert.equal(make("p-1", { siteId: "amazon", memberFree: true }).memberFree, "prime");
  assert.equal(make("p-2", { siteId: "walmart", memberFree: true }).memberFree, "walmartplus");
  assert.equal(make("p-3", { siteId: "ebay", memberFree: true }).memberFree, null);
});

test("your total and its wording", () => {
  const shipped = make("p-1");
  const free = make("p-2", { siteId: "amazon", shipping: "5.99", memberFree: true });
  const unknown = make("p-3", { shipping: "" });
  const zero = make("p-4", { shipping: "0" });
  assert.deepEqual([shipped, free, unknown, zero].map(totalCents), [1650, 1250, 1250, 1250]);
  assert.equal(describePrice(shipped), "$12.50 + $4.00 shipping");
  assert.equal(describePrice(free), "$12.50 + free shipping (Amazon Prime)");
  assert.equal(describePrice(unknown), "$12.50, shipping not entered");
  assert.equal(describePrice(zero), "$12.50 + free shipping");
});

const search = (id, prices = []) => ({ id, label: id, input: { words: id }, prices, created: NOW, updated: NOW });

test("add and delete a price leave the original list unchanged", () => {
  const list = [search("s-1"), search("s-2")];
  const p = make("p-1");
  const added = addPrice(list, "s-1", p);
  assert.deepEqual(added[0].prices, [p]);
  assert.deepEqual(list[0].prices, []);
  assert.deepEqual(addPrice(list, "nope", p), list);
  assert.deepEqual(deletePrice(added, "s-1", "p-1")[0].prices, []);
  assert.deepEqual(deletePrice(added, "s-1", "nope"), added);
  assert.equal(added[0].prices.length, 1);
});

test("latest price: newest date; same date goes to the one entered last", () => {
  const r = search("s-1", [
    make("p-1", { date: "2026-10-20", amount: "10" }, "2026-11-01T09:00:00Z"),
    make("p-2", { date: "2026-11-01", amount: "20" }, "2026-11-01T10:00:00Z"),
    make("p-3", { date: "2026-11-01", amount: "30" }, "2026-11-01T11:00:00Z"),
    make("p-4", { date: "2026-10-01", amount: "40" }, "2026-11-02T08:00:00Z"), // entered later, older date
    make("p-5", { kind: "asking", date: "2026-10-15", amount: "50" }),
  ]);
  assert.equal(latestPrice(r, "sold").id, "p-3");
  assert.equal(latestPrice(r, "asking").id, "p-5");
  assert.equal(lastChecked(r), "2026-11-01");
  assert.deepEqual(pricesNewestFirst(r).map((p) => p.id), ["p-3", "p-2", "p-1", "p-5", "p-4"]);
  const none = search("s-2");
  assert.equal(latestPrice(none, "sold"), null);
  assert.equal(lastChecked(none), null);
});

test("sorting: price sorts use your total; missing values go last; ties keep order", () => {
  const sold = (id, amount, date = "2026-11-01", shipping = "") => make(id, { amount, shipping, date });
  const asking = (id, amount) => make(id, { kind: "asking", amount, shipping: "" });
  const list = [
    search("a", [sold("a1", "20")]),                          // sold 20.00
    search("b"),                                              // nothing
    search("c", [sold("c1", "15", "2026-10-01", "10")]),      // sold 25.00 (15 + 10)
    search("d", [asking("d1", "5")]),                         // asking only
    search("e", [sold("e1", "20", "2026-10-15")]),            // sold 20.00, ties a
  ];
  const ids = (mode) => sortSearches(list, mode).map((r) => r.id);
  assert.deepEqual(ids("newest"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(ids("soldLow"), ["a", "e", "c", "b", "d"]);
  assert.deepEqual(ids("soldHigh"), ["c", "a", "e", "b", "d"]);
  assert.deepEqual(ids("askingLow"), ["d", "a", "b", "c", "e"]);
  // a and d were both last checked Nov 1, so they keep their order.
  assert.deepEqual(ids("checkedOldest"), ["b", "c", "e", "a", "d"]);
  assert.deepEqual(ids("nonsense"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(list.map((r) => r.id), ["a", "b", "c", "d", "e"], "input unchanged");
  assert.deepEqual(SORT_MODES.map((m) => m.id), ["newest", "soldLow", "soldHigh", "askingLow", "checkedOldest"]);
});

test("sorting an empty list or a list with no prices", () => {
  assert.deepEqual(sortSearches([], "soldLow"), []);
  const list = [search("x"), search("y")];
  for (const { id } of SORT_MODES) assert.deepEqual(sortSearches(list, id).map((r) => r.id), ["x", "y"], id);
});
