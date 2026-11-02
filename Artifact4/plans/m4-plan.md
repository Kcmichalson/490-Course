# M4 plan: hand-over fixes

Approved 2026-11-01 (Session 1). **Result:** built the same day; Kc's
by-eye check and Mercari Japan checks 36 and 37 passed. M4 complete.
Beyond the plan: prefs save `knownStores`, so a store added later starts
off (LOG.md, "M4 fixes").

## Context
Dad's feedback (LOG.md, "M4 hand-over feedback"):
- "category hint seems to be useless."
- "why does it say when stuff is already opened?"

Kc asked for JP Mercari. Kc's decisions: remove the category hint; remove
the opened tracking; add JP Mercari using the English words as typed (no
translation, since a translation service would need a network call and
usually a key).

## 1. Remove the category hint
- Remove the sidebar section and src/core/categories.js (created this
  session).
- Drop the remembered `category`.
- Remove its test.
- Mark SPEC section 2's category-hints row as removed.

## 2. Remove the "opened" tracking
- No "Opened" labels, no highlighted next card, no "Next: eBay, 3 of 10"
  status.
- Open next still steps through the stores and names the next one ("Open
  next: eBay"); after the last one it reads "Start over".
- Open all marks nothing. The blocked pop-ups message stays.

## 3. JP Mercari (11th store)
- `https://jp.mercari.com/search?keyword=…` (Kc's example URL), with
  the words as typed.
- Sold filter and newest-first sort: web lookup (pages treated as data),
  then Kc's URL checks before they count as confirmed.
- Price is skipped ("can't do price"): the app's price is in dollars,
  JP Mercari's is in yen.
- Off by default; remembered choices unchanged.
- Note: "Japanese site: English words may find fewer results."

## 4. "How to use it" help
A short collapsible section above the results: the two boxes and -words,
Current vs Sold, Open all and pop-ups.

## 5. Open all message
The last step becomes "…then press Open all again (if nothing happens,
reload this page first)".

## Tests and checks
- JP Mercari adapter tests (exact URLs after Kc's checks); the registry
  test expects 11 stores; Open next names the next store.
- Tests that relied on the category or the opened tracking are removed or
  updated and named in LOG.md.
- Built-in browser at 1280 and 400 px; Kc's by-eye checklist and JP
  Mercari URL checks; LOG.md; a commit message.
