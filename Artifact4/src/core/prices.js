// Prices he records on a saved search (M3). The app never reads prices from
// a store; he types in what he saw. Pure logic: no DOM, runs in Node.
//
// { id, kind: "sold" | "asking", siteId, amount, shipping, memberFree,
//   date: "YYYY-MM-DD", note, created }
// Money is whole cents (amount, shipping), so totals never pick up float
// errors. shipping null = not entered. memberFree = the membership that
// made shipping free on this price, or null.

import { MEMBERSHIPS } from "./memberships.js";

export const PRICE_KINDS = ["sold", "asking"];
export const OTHER_SITE = { id: "other", name: "Other" };
const MAX_CENTS = 100_000_000; // $1,000,000

export const PRICE_MESSAGES = {
  amount: "Enter the price, like 12.50.",
  shipping: "Shipping should be a dollar amount, like 4.99, or blank.",
  kind: "Pick Sold or Asking.",
  site: "Pick a store.",
  date: "Pick a date.",
};

export const SORT_MODES = [
  { id: "newest", label: "Newest saved" },
  { id: "soldLow", label: "Sold price, low to high" },
  { id: "soldHigh", label: "Sold price, high to low" },
  { id: "askingLow", label: "Asking price, low to high" },
  { id: "checkedOldest", label: "Checked longest ago" },
];

// "$1,250.5" -> 125050. Blank, negative, junk or over $1,000,000 -> null.
export function parseMoney(value) {
  if (typeof value === "number") value = String(value);
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents <= MAX_CENTS ? cents : null;
}

export function formatMoney(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// A real calendar date as YYYY-MM-DD.
export function isDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Today in his local time, as YYYY-MM-DD.
export function localDay(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-11-01" -> "Nov 1" this year, "Nov 1, 2025" another year.
export function formatDay(day, today) {
  const [y, m, d] = day.split("-").map(Number);
  const short = `${MONTHS[m - 1]} ${d}`;
  return y === today.getFullYear() ? short : `${short}, ${y}`;
}

// The membership whose free shipping can apply to a price on this site.
export function membershipFor(siteId) {
  return MEMBERSHIPS.find((m) => m.siteId === siteId) ?? null;
}

// A stored or imported price, or null if it can't be used.
export function cleanPrice(raw, siteIds) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !/^[\w-]{1,64}$/.test(raw.id)) return null;
  if (!PRICE_KINDS.includes(raw.kind)) return null;
  if (raw.siteId !== OTHER_SITE.id && !siteIds.includes(raw.siteId)) return null;
  const ok = (n, min) => Number.isInteger(n) && n >= min && n <= MAX_CENTS;
  if (!ok(raw.amount, 1)) return null;
  if (raw.shipping !== null && !ok(raw.shipping, 0)) return null;
  if (!isDay(raw.date) || typeof raw.created !== "string" || Number.isNaN(Date.parse(raw.created))) return null;
  const member = membershipFor(raw.siteId);
  return {
    id: raw.id,
    kind: raw.kind,
    siteId: raw.siteId,
    amount: raw.amount,
    shipping: raw.shipping,
    memberFree: member && raw.memberFree === member.id ? member.id : null,
    date: raw.date,
    note: typeof raw.note === "string" ? raw.note.trim().slice(0, 200) : "",
    created: raw.created,
  };
}

// The record-a-price form -> { ok: true, price } or { ok: false, message }.
// form: { kind, siteId, amount, shipping, memberFree (bool), date, note }
export function priceFromForm(form, { id, now, siteIds }) {
  if (!PRICE_KINDS.includes(form.kind)) return { ok: false, message: PRICE_MESSAGES.kind };
  if (form.siteId !== OTHER_SITE.id && !siteIds.includes(form.siteId)) {
    return { ok: false, message: PRICE_MESSAGES.site };
  }
  const amount = parseMoney(form.amount);
  if (amount === null || amount === 0) return { ok: false, message: PRICE_MESSAGES.amount };
  const shippingText = String(form.shipping ?? "").trim();
  const shipping = shippingText === "" ? null : parseMoney(shippingText);
  if (shippingText !== "" && shipping === null) return { ok: false, message: PRICE_MESSAGES.shipping };
  if (!isDay(form.date)) return { ok: false, message: PRICE_MESSAGES.date };
  const member = membershipFor(form.siteId);
  const price = cleanPrice({
    id,
    kind: form.kind,
    siteId: form.siteId,
    amount,
    shipping,
    memberFree: form.memberFree && member ? member.id : null,
    date: form.date,
    note: form.note,
    created: now,
  }, siteIds);
  return { ok: true, price };
}

export function addPrice(list, searchId, price) {
  return list.map((r) => (r.id === searchId ? { ...r, prices: [...r.prices, price] } : r));
}

export function deletePrice(list, searchId, priceId) {
  return list.map((r) => (r.id === searchId ? { ...r, prices: r.prices.filter((p) => p.id !== priceId) } : r));
}

// Your total: the price plus shipping; free shipping by membership counts
// as $0, and shipping not entered counts as $0 (and is said so).
export function totalCents(price) {
  return price.amount + (price.memberFree ? 0 : price.shipping ?? 0);
}

// "$12.50 + $4.00 shipping", "$12.50 + free shipping (Amazon Prime)",
// "$12.50, shipping not entered", or "$12.50 + free shipping".
export function describePrice(price) {
  const amount = formatMoney(price.amount);
  if (price.memberFree) {
    const member = MEMBERSHIPS.find((m) => m.id === price.memberFree);
    return `${amount} + free shipping (${member.label})`;
  }
  if (price.shipping === null) return `${amount}, shipping not entered`;
  if (price.shipping === 0) return `${amount} + free shipping`;
  return `${amount} + ${formatMoney(price.shipping)} shipping`;
}

// Newest date wins; on the same date, the one entered last.
const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created);

export function pricesNewestFirst(record) {
  return [...record.prices].sort(newestFirst);
}

export function latestPrice(record, kind) {
  return record.prices.filter((p) => p.kind === kind).sort(newestFirst)[0] ?? null;
}

// The newest recorded price date, or null if he hasn't recorded any.
export function lastChecked(record) {
  return record.prices.reduce((latest, p) => (latest === null || p.date > latest ? p.date : latest), null);
}

// The list arrives newest-saved first; every sort is stable, so ties keep
// that order. Searches without the value sorted on go last, except that
// never-checked searches go first on "checked longest ago".
export function sortSearches(list, mode) {
  const byTotal = (kind, direction) => (a, b) => {
    const pa = latestPrice(a, kind);
    const pb = latestPrice(b, kind);
    if (!pa || !pb) return (pa ? 0 : 1) - (pb ? 0 : 1);
    return direction * (totalCents(pa) - totalCents(pb));
  };
  const sorters = {
    soldLow: byTotal("sold", 1),
    soldHigh: byTotal("sold", -1),
    askingLow: byTotal("asking", 1),
    checkedOldest: (a, b) => {
      const ca = lastChecked(a);
      const cb = lastChecked(b);
      if (!ca || !cb) return (ca ? 1 : 0) - (cb ? 1 : 0);
      return ca.localeCompare(cb);
    },
  };
  return sorters[mode] ? [...list].sort(sorters[mode]) : [...list];
}
