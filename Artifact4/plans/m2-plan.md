# M2 plan: Saved searches

Approved 2026-11-01 (Session 1) as written, with the defaults for every open
question (section 8). Kc's note: loading a saved search may change the
remembered filters; that's fine.

## Context
M1 is done: the app builds confirmed search links for all ten sites from one
search and the sidebar filters. M2 (SPEC section 6) lets him keep a list of
searches he re-checks and carry the list between browsers:
- save the current search with its filters; edit; delete
- each saved search shows its site buttons, so re-checking is one click
- filter the list by text or category
- "My memberships" in the sidebar
- export to a JSON file and import it back, with a clear message for a bad
  file

M3 (recording prices) is not part of this. The saved-search format leaves
room for it (a version number) but adds no price fields.

## 1. Files
```
src/core/saved.js          NEW, pure: saved-search records, add / update /
                           delete, list filter, export text, import parsing
src/core/memberships.js    NEW, pure: the membership list (id, label, note)
src/core/prefs.js          + memberships: [] (validated; still version 1)
src/core/query.js          buildSearch carries memberships through
src/core/sites/amazon.js   + Prime filter when "Amazon Prime" is checked
src/core/sites/index.js    buildLinks returns notes[] (site/link note +
                           membership note) instead of one note
src/ui/storage.js          + loadSavedText / saveSavedText ("pc:saved")
src/ui/sidebar.js          + "My memberships" checkboxes; apply(filters)
                           to load a saved search into the form
src/ui/search-bar.js       + setWords(text)
src/ui/saved-list.js       NEW: the Saved searches view (filter, cards,
                           export / import)
src/ui/results.js          + "Save this search" / "Update saved search";
                           render notes[]
src/main.js, index.html, style.css   wiring, the view switch, new styles
tests/saved.test.js, tests/memberships.test.js   NEW
tests/prefs.test.js, amazon.test.js, registry.test.js   extended
```
Existing helpers are reused, not copied:
- `buildSearch`, `filterSummary` (src/core/query.js);
- `buildLinks`, `SITE_IDS` (src/core/sites/index.js);
- `CATEGORIES`, `findCategory` (src/core/categories.js);
- `encodeQuery`, the `el()` DOM helper (results.js), and the `parsePrefs`
  "never throws, fall back to defaults" pattern.

## 2. Saved-search data (src/core/saved.js)
A record keeps the raw form input, so links are rebuilt with the current
adapters. A fixed site URL then fixes every saved search automatically.
```js
{ id: "s-…", label: "russell wilson foil card",      // label defaults to words
  input: { words, priceMin, priceMax, condition, format, exclude, category,
           storesOff, location: { zip, radius, craigslistCity, facebookCity } },
  created: "2026-11-03T…Z", updated: "2026-11-03T…Z" }
```
- Stored under `pc:saved` as `{ version: 1, searches: [...] }`.
- Pure functions; the id and time are passed in, so tests are exact:
  - `addSearch(list, input, { id, now })`
  - `updateSearch(list, id, input, now)`
  - `renameSearch(list, id, label)`
  - `deleteSearch(list, id)`
  - `filterSearches(list, { text, category })`: text matches the label and
    words, case-insensitive; category matches `input.category`
  - `parseSaved(text)`: never throws; bad data gives an empty list, bad
    records are dropped
  - `exportText(list, now)`
  - `parseImport(text)` → `{ ok, searches, message }`
- Each record is checked with the same rules as prefs: known condition,
  format and category; ZIP and city cleanup; store ids known; strings
  length-capped. An unknown store id is dropped, not fatal.
- Newest first. No limit on count; a 1 MB cap on import files.
- Export file: `{ "app": "price-check", "version": 1, "exported": "<ISO>",
  "searches": [...] }`, named `price-check-searches-YYYY-MM-DD.json`.
- Bad-file messages (shown in the Saved view, nothing changes):
  - not JSON: "That file isn't a Price Check export (it isn't valid JSON)."
  - wrong shape or `app`: "That file isn't a Price Check export."
  - newer version: "That file is from a newer version of Price Check."
  - too large: "That file is too large (over 1 MB)."
  - no valid searches: "That file has no saved searches in it."
- Import **merges**: searches whose id is already in the list are skipped.
  The message reports both counts: "Imported 5 searches (2 were already
  saved)."

## 3. Memberships
- Sidebar section "My memberships": checkboxes for **Amazon Prime** and
  **Walmart+** (SPEC's two examples), remembered in `pc:prefs`. These are
  labels to tick, not claims about him.
- **Amazon Prime:** if checked, the Amazon link adds the Prime-eligible
  filter `p_85:2470955011` to `rh`, comma-joined with the price
  (`p_36:500-5000,p_85:2470955011`). This is **unconfirmed (check 34)**;
  until you confirm it, it ships in the `unconfirmed` list like before.
  Card note: "Prime: showing Prime-eligible items; free shipping on them,
  so compare totals."
- **Walmart+:** no known link filter, so note only: "Walmart+: free
  shipping on eligible items, so compare totals."
- Memberships aren't one of the five filters, so they don't change "All
  filters" / "can't do" wording. They only add the note, and Amazon's
  Prime filter.
- Membership wording is my draft; change it if you like.

## 4. UI
- **Header:** two tabs, **Search** and **Saved (N)**. A tab is a button
  with `aria-pressed`. The Saved view replaces the results area; the
  sidebar stays on Search only.
- **Search view, results head:**
  - "Save this search" saves the current words and filters, labeled with
    the words, and shows "Saved."
  - While a saved search is loaded, the head shows "Update saved search"
    (overwrites it) and "Save as new".
- **Saved view:**
  - a text box ("Filter saved searches"), a category select (All / Cards /
    Toys and figures / Furniture / Other), and Export and Import buttons;
  - one card per search: the label (editable through a "Rename" button),
    a one-line filter summary ("$5–$50 · Used · 10 stores"), and its site
    buttons as compact Sold/Asking chips that open in new tabs (one click
    to re-check);
  - per card: **Load** (fills the search bar and sidebar, switches to
    Search), **Rename**, and **Delete** (asks "Delete '<label>'?" first);
  - empty states: "No saved searches yet. Search, then press Save this
    search." and "No saved searches match."
- **Remembering:** loading a saved search applies its stores and filters
  the same as if he had clicked them, so it may change the remembered
  filters (Kc: fine).
- **Storage failure** (private window or full storage): "Couldn't save in
  this browser. Export a copy to keep your searches."
- **Layout:** works from ~380 to ~1600 px; chips wrap; cards stack on
  phones. All new colors are CSS variables in `:root`.

## 5. Tests (`node --test "tests/*.test.js"`)
- **saved.test.js:**
  - add (label, id, times, newest first);
  - update (keeps id and created, changes updated);
  - rename (blank → words);
  - delete (unknown id → unchanged);
  - filter (text, case, category, both, empty);
  - parseSaved (garbage → empty; bad record dropped; unknown store
    dropped);
  - export → import round trip, deep-equal;
  - import merge (skips existing ids, counts);
  - every bad-file case above, each giving its message and changing
    nothing;
  - special characters (é & " #) survive the round trip.
- **prefs.test.js:** memberships default `[]`; unknown ids dropped; round
  trip.
- **memberships.test.js:** ids unique; every note non-empty.
- **amazon.test.js:** Prime alone; Prime plus price (comma-joined `rh`);
  no Prime → unchanged URLs (the golden checks 18/23/27 still pass); the
  exact Prime URL test is `todo` until check 34.
- **registry.test.js:** buildLinks gives `notes` (array); a membership note
  appears only on its site.

## 6. Check 34 (Kc, by eye)
- a. Prime only: https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_85%3A2470955011&s=date-desc-rank
  (the Prime checkbox under Delivery is checked)
- b. Prime plus price: https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_36%3A2000-5000%2Cp_85%3A2470955011&s=date-desc-rank
  (Prime checked, and the price filter shows $20–$50)

If it fails, the Prime filter is dropped and the note stays.

**Result (2026-11-01):** Kc saw no Prime option on Amazon (maybe because of
not being signed in), so check 34 couldn't confirm it. The Prime filter was
dropped; the Prime note stays. M2's by-eye check passed. M2 complete.

## 7. Checks for M2
- Tests pass.
- By eye, http://127.0.0.1:8004, at ~1280 px:
  1. save five searches (the three test searches plus two more with
     different filters);
  2. reload: all five are still there;
  3. filter by text and by category;
  4. rename one; delete one;
  5. Load one: the sidebar and words match, and "Update saved search"
     works;
  6. click a few chips: each opens the right search;
  7. Export; delete `pc:saved` in DevTools (Application > Local Storage);
     reload (empty); Import the file: all back, with the message;
  8. import a bad file (e.g., a .txt renamed to .json): clear message,
     list unchanged;
  9. tick Amazon Prime: the Amazon link and note change.
- At ~400 px: tabs, cards, chips and buttons wrap, with no sideways scroll
  and nothing clipped.
- Claude runs the same in the built-in browser first, with `window.open`
  and downloads stubbed, and opens no store sites.
- Then update LOG.md (planned / changed / problems / checks), stop, and
  suggest a commit message.

## 8. Decisions on the open questions (defaults accepted)
1. **What a saved search keeps:** words and every sidebar filter,
   including stores and location. Memberships stay global.
2. **Import:** merge, skipping ids already saved.
3. **"Clear" for the check:** no "Delete all" button; clear `pc:saved` in
   DevTools.
4. **Membership list:** Amazon Prime and Walmart+ only.
5. **Saved view:** a tab.
6. **Edit:** Rename, plus Load then "Update saved search"; no separate edit
   form.
7. **Export:** saved searches only.
8. **Sort:** newest first. M3 adds price and "checked longest ago" sorts.

Suggested extras (not in M2): "Duplicate" on a card; remembering the last
Saved-view filter text.
