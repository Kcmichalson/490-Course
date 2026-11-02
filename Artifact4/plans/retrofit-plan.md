# Retrofit plan: Price Check as a mass-search tool

Approved 2026-11-01 (Session 1) as written. **Result:** built the same day;
Kc's by-eye check and check 35 passed. Retrofit complete.

## Context
Kc wants the app focused on one job: take a single search and open it on
every selected store, correctly formatted for each store's URL. Your
answers:
- **Stores:** keep the ten.
- **Operators:** words (AND), "exact phrases" and -exclusions.
- **Input:** two boxes, both always shown. "Search for" understands
  -words and "phrases"; "Leave out" takes a comma-separated list.
- **Remove M2/M3:** saved searches, recorded prices and memberships.
- **Sold vs current:** "open either sold listings or currently listed
  listings". Instead of two groups, a switch picks one view, and every
  link (and Open all) follows it.

## 1. Search input (index.html, src/ui/search-bar.js, src/core/query.js)
- **The header form has:**
  - **Search for:** e.g. `russell wilson foil card -rerun -reprint` or
    `"black series" vader`;
  - **Leave out:** e.g. `rerun, reprint, base set`;
  - the Search button.

  On phones they stack.
- **New `parseQuery(searchText, leaveOutText)`** in query.js returns
  `{ tokens, exclude }`:
  - `-word` and `-"a phrase"` in Search for become leave-outs;
  - "Leave out" splits on **commas only**, so `base set` is one phrase;
    a leading `-` and quotes are stripped;
  - leave-outs are lowercased and each kept once; a word in both lists
    counts once;
  - a lone `-` or an empty item is ignored; curly quotes work (phones).

  `buildSearch` uses it in place of `splitWords` + `parseExclude`.
- **Sidebar:** the "Exclude words" section moves out (it is "Leave out"
  now). The category hint's "Use these" adds its words to the Leave out
  box.
- **Results head:** shows what was understood, e.g. "Searching for
  russell wilson foil card · Leaving out: rerun, reprint".
- **eBay and Craigslist** (the two stores that can exclude in the link)
  write a phrase as `-"base set"` and a word as `-rerun`. Phrase
  exclusion is **unconfirmed (check 35)**. The other eight stores keep
  saying "can't do exclude words".

## 2. Sold / current switch (src/ui/results.js, prefs)
- **A two-button switch** above the results: **Current listings**
  (default) | **Sold listings**. It's remembered in `pc:prefs` as
  `view: "asking" | "sold"`.
- **One list of links** in SPEC order, for the chosen view only. The
  "Sold for" / "Asking now" groups go.
- **Sold view:** only eBay, Mercari, Poshmark and ShopGoodwill have one.
  The other selected stores are listed once: "No sold view: Facebook
  Marketplace, Craigslist, …".
- **Open all (N)** and **Open next** use the shown list. Badges, the
  filter text, notes (e.g. eBay's sign-in note) and the blocked-tabs
  message stay.
- `buildLinks(search, selectedIds, today, view)` gains a view filter.
  The adapters don't change; each still builds both views.

## 3. Removal (all files created this session)
- **Delete:**
  - src/core/saved.js, src/core/prices.js, src/core/memberships.js;
  - src/ui/saved-list.js;
  - tests/saved.test.js, tests/prices.test.js, tests/memberships.test.js.
- **Remove:**
  - the Search/Saved tabs and the saved view;
  - the save buttons in results.js;
  - the "My memberships" sidebar section;
  - membership notes in sites/index.js (`notes[]` stays);
  - `memberships` in prefs and `buildSearch`;
  - `loadSavedText` / `saveSavedText`, and saved/price/membership wiring
    in main.js and styles;
  - the membership tests in amazon.test.js and registry.test.js.
- **Data left alone:** a `pc:saved` entry already in your browser stays
  and is ignored (nothing deletes your data). Old `memberships` in
  `pc:prefs` are dropped on the next save.
- **Kept:** the ten adapters and their tests; Open all / Open next;
  filters (stores, price, condition, buying format, location, category
  hint); default stores eBay / Facebook / Mercari; prefs memory.

## 4. Docs
- **SPEC:**
  - section 1 (purpose: mass search; the two inputs; the sold/current
    switch);
  - section 4 (search bar and sidebar);
  - section 5 (no Sold/Asking groups);
  - section 6: M2 and M3 "removed in the retrofit (2026-11-01)", with
    plans/m2-plan.md and plans/m3-plan.md kept as history; M4 stays;
  - section 7: saved searches and price notes out of scope.
- **LOG.md:** a decision entry, the build entry, the prompt log, and the
  milestone status (M2 and M3 marked removed).
- **CLAUDE.md** still says "keeps a list of his saved searches" and
  "Saved searches must be exportable and importable". I can't edit
  CLAUDE.md (permission rule), so **you'd update those two lines**. I'll
  list the exact text.
- Saved as plans/retrofit-plan.md on approval.

## 5. Tests
- **query.test.js:**
  - parseQuery: -words, `-"phrases"`, Leave-out commas and phrases,
    duplicates across both boxes;
  - quotes kept for includes; curly quotes; a lone `-`; empty input;
  - é & # in both boxes.
- **ebay.test.js / craigslist.test.js:** a phrase exclusion is written as
  `-"base set"`, with an exact URL; the golden check URLs from M1 still
  pass.
- **registry.test.js:**
  - `buildLinks` with `view: "asking"` gives 10 links in SPEC order;
  - `"sold"` gives eBay, Mercari, Poshmark and ShopGoodwill only;
  - an unknown view → asking.
- **prefs.test.js:** `view` defaults to "asking"; a bad value → default;
  `memberships` gone.
- Tests asserting the old space-split exclude (`parseExclude`) or the
  old groups are updated, each named in LOG.md with the reason.

## 6. Check 35 (yours, by eye)
- a. eBay: https://www.ebay.com/sch/i.html?_nkw=pokemon+card+-%22base+set%22&_sop=10
  ("base set" cards are gone from the results)
- b. Craigslist: https://seattle.craigslist.org/search/sss?query=pokemon+card+-%22base+set%22&sort=date

If it fails, phrases are excluded word by word on that store.

## 7. Checks
- Tests pass.
- Built-in browser, with `window.open` stubbed:
  - `russell wilson foil card -rerun -reprint` alone, then with
    `base set` in Leave out → the "Leaving out" line and each link's
    filter text;
  - Current ↔ Sold switch (10 links ↔ 4 plus the "No sold view" line);
  - Open all in each view;
  - no Saved tab or memberships; reload remembers the view;
  - 1280 and 400 px; no console errors.
- Your by-eye checklist afterward, then LOG.md and a commit message.
