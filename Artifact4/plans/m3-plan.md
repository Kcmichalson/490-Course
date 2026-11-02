# M3 plan: Recording prices

Approved 2026-11-01 (Session 1) with one change: when an imported search is
already saved, merge its prices by price id instead of skipping it. Prices
that aren't there yet are added, duplicates are skipped, and the message
reports counts ("Imported 2 new searches and 5 new prices; 3 already
saved"). That merge gets tests: new prices added, duplicates skipped, the
existing search's label and filters unchanged. Defaults accepted for
everything else (section 6).

## Context
M2 is done: saved searches with links, filters, export and import. M3 (SPEC
section 6) lets him write down prices he sees on the store pages. The app
still never reads prices itself; he types them in. Each saved search then
shows its latest sold price, latest asking price and when it was last
checked, and the list can be sorted by price or by "checked longest ago".
SPEC section 4 also asks for "your total" with shipping and membership
effects.

## 1. Files
```
src/core/prices.js        NEW, pure: money parsing/formatting, price records,
                          add / delete, your total, latest sold / asking,
                          last checked, list sorting
src/core/saved.js         records gain prices: []; SAVED_VERSION 1 -> 2
                          (version 1 files and storage still load); import
                          merges prices into already-saved searches
src/ui/saved-list.js      card: latest sold / asking / last checked lines,
                          "Record a price" form, "Prices (N)" history with
                          Delete; a Sort select in the filter bar
src/main.js               onRecordPrice / onDeletePrice -> commitSaved
style.css                 price lines, form, history (CSS variables only)
tests/prices.test.js      NEW
tests/saved.test.js       extended (prices round trip, v1 file still
                          imports, price merge)
```
Reused as-is:
- `commitSaved`, `parseSaved` / `cleanList`, `exportText`, `mergeImport`
  (src/core/saved.js, main.js);
- `MEMBERSHIPS` (src/core/memberships.js);
- `SITES`, `SITE_IDS` (src/core/sites/index.js);
- `el()` (src/ui/results.js).

## 2. Price data (src/core/prices.js)
A price lives on its saved search:
```js
{ id: "p-…", kind: "sold" | "asking", siteId: "ebay" | … | "other",
  amount: 1250, shipping: 400 | 0 | null,   // cents; null = not entered
  memberFree: "prime" | "walmartplus" | null, // free shipping via membership
  date: "2026-11-03", note: "graded PSA 9", created: "<ISO>" }
```
- **Money** is stored as whole cents, so totals never pick up float
  errors. `parseMoney("$1,250.5")` → 125050. Blank, negative, over
  $1,000,000 or junk → null. `formatMoney(1250)` → "$12.50".
- **Your total:** amount + shipping. Shipping counts as $0 when
  `memberFree` is set. When shipping wasn't entered, the total is the
  amount, marked "shipping not entered".
- **Membership effect:** the record form shows "Free shipping with
  <membership>" only when he has that membership ticked and picks its store
  (Prime → Amazon, Walmart+ → Walmart). It's saved on the price, so
  un-ticking a membership later doesn't change old totals.
- **Checks on a price:**
  - amount required and over $0;
  - shipping optional, $0 or more;
  - kind is sold or asking;
  - store is one of the ten or "Other";
  - date is a real `YYYY-MM-DD`, defaulting to today in local time;
  - note capped at 200 characters.
  - The form shows a clear message for a bad amount or date.
- **Functions** (each returns a new list):
  - add and delete a price;
  - `totalCents`;
  - `latestPrice(record, kind)`: the newest date; on a tie, the one
    entered last; null if none;
  - `lastChecked(record)`: the newest price date, or null;
  - `sortSearches(list, mode)`.
- **Sort modes** (a Sort select in the Saved view):
  - Newest saved (default);
  - Sold price, low to high, and high to low;
  - Asking price, low to high;
  - Checked longest ago.
  - Price sorts use your total. Searches with no price of that kind go
    last; never-checked searches go first on "checked longest ago". Ties
    keep newest-saved order.
- **Version bump:** saved data and export files become version 2.
  Version 1 storage and files load with `prices: []`, and a version 3 file
  gets the "newer version" message.
- **Import (Kc's change):**
  - A new search is added with its prices.
  - For a search already saved (same id), imported prices whose ids aren't
    there yet are added. Duplicates are skipped, and the saved search's
    label and filters stay as they are.
  - The message counts new searches, new prices (all prices new to his
    list) and searches already saved, e.g. "Imported 2 new searches and 5
    new prices; 3 already saved."

## 3. UI (Saved view card)
```
russell wilson foil card
$5–$50 · 10 stores
Sold:   $16.50 your total ($12.50 + $4.00 shipping) · eBay · Nov 1
Asking: $20.00 your total (shipping not entered) · Mercari · Nov 1
Last checked Nov 1                     (or "Not checked yet")
[store chips…]
[Load] [Record a price] [Rename] [Delete]
▸ Prices (3)    (a list, newest first, each with a Delete button)
```
- **Record a price** opens an inline form on the card:
  - Sold / Asking;
  - Store (the ten plus Other; defaults to the first store in the search);
  - Price $ and Shipping $;
  - "Free shipping with Prime" (only when it applies);
  - Date (today);
  - Note (optional);
  - Save price / Cancel.
- After Save, a status shows: "Recorded $12.50 sold on eBay."
- Deleting a price asks first.
- Dates show as "Nov 1" in the current year, else "Nov 1, 2025".
- Everything wraps from ~380 to ~1600 px.

## 4. Tests
- **prices.test.js:**
  - money parsing and formatting;
  - your total (shipping, free shipping by membership, not entered);
  - a price is rejected for bad amount, kind, store or date;
  - add and delete are immutable;
  - latestPrice (date, ties, none, kinds kept apart);
  - lastChecked;
  - every sort mode, including searches with no prices and ties.
- **saved.test.js:**
  - storage and export round trip keep prices;
  - a version 1 file imports with `prices: []`; version 2 is accepted,
    version 3 is rejected;
  - bad prices are dropped and the search is kept;
  - **price merge:** new prices added; duplicate price ids skipped; the
    existing search's label and filters unchanged; the counts in the
    message.

## 5. Checks for M3
- Tests pass.
- Built-in browser at 1280 and 400 px:
  - record prices on three searches;
  - check the latest and last-checked lines;
  - try each sort;
  - delete a price;
  - reload;
  - export → clear → import, and a merge import.
  - No store sites opened.
- Kc's by-eye check at http://127.0.0.1:8004 (a checklist once built),
  using the three test searches. His real searches come at the M4
  hand-over.
- Then update LOG.md, stop, and suggest a commit message.

## 6. Decisions (defaults accepted)
1. By-eye check uses the three test searches now; his real searches at M4.
2. "Last checked" = the newest recorded price date.
3. "Latest" = newest date; on a tie, the one entered last.
4. Price sorts use your total.
5. Editing a price = delete and re-enter.
6. The store list in the form is the ten plus "Other".
7. Membership free shipping is a per-price checkbox, shown only for Prime
   on Amazon and Walmart+ on Walmart when ticked.
8. Prices are recorded only in the Saved view.
9. Import: replaced by Kc's change (merge prices by id).

Suggested extras (not in M3): edit a price in place; a small price history
line per store.

**Result (2026-11-01):** M3 complete. Kc found "Record a price" unclear at
first, so the form now starts with an explanation (plans/refocus-plan.md).
Per Kc's links-first decision, price recording is an optional notebook.
