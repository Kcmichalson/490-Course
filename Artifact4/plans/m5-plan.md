# M5 plan: shareable search links and a keyword helper

**Result (2026-11-07):** M5 complete.
- The word list was revised at Kc's request to 118 entries in 12 groups
  and approved.
- Beyond the plan: `linkSettings` makes settings a link leaves out go to
  their default (Kc's "falls back to defaults").
- Kc's by-eye check passed.

Approved 2026-11-07 (Session 2) with Kc's changes:
1. Shared links are simplified: opening one applies its search and filters
   like a normal change and saves them as usual. No visit-only mode, no
   sessionStorage, no note.
2. Word list: every entry needs at least one alternate that real listings
   use; entries without one are dropped (e.g. obo, dovetail, teak, loose).
   Kc sees the final list as a table before the chips are built.
3. eBay OR chip: left out.
4. The old M5 (live prices) is renamed "Declined: live prices (formerly
   M5)". Claude lists the CLAUDE.md lines for Kc to update.

Defaults accepted for the rest:
- the address bar updates live;
- "Include my location" is unticked each visit;
- `russell wilson` is the only name-based misspelling;
- at most 4 chips.

## Context
- **Shareable link:** reproduces a search (words, leave-outs, view, stores,
  filters).
- **Keyword helper:** suggests alternate searches for listing jargon,
  common misspellings and synonyms.
- Both stay static: no network, no AI, and the hash never leaves the
  browser.

## 1. Shareable links (src/core/share.js, pure)
- **`encodeShare(state, { includeLocation })`** → `#q=…&x=…&v=s&st=ebay,mercari&lo=5&hi=50&c=u&f=b`.
  - Keys:
    - `q` Search for, `x` Leave out;
    - `v=s` for Sold;
    - `st` the selected store ids (always written);
    - `lo` / `hi` price;
    - `c` condition (`n` / `u`), `f` format (`a` / `b`);
    - with "Include my location": `z`, `r`, `cl`, `fb`.
  - Keys at their default are left out.
- **`decodeShare(hash, siteIds)`** returns only fields it could read and
  validate, and never throws. Missing fields keep the visitor's own
  settings.
- **Address bar:** `history.replaceState` writes the hash after each
  change. Copy link copies the address and shows "Link copied." If the
  clipboard isn't available, it shows the link in a box: "Press Ctrl+C to
  copy."
- **"Include my location" checkbox:** unticked each visit.
- **Opening a link** (on load or hash change) fills the boxes, the view
  and the sidebar, builds the links, and saves the choices as usual.

## 2. Keyword helper (src/core/keywords.js, pure)
- **The list:** about 50 entries in four groups (cards, toys and figures,
  furniture, general). Each has a meaning and at least one alternate
  that real listings use (a synonym, an expansion or a common
  misspelling).
- **Matching:** case-insensitive, ignores punctuation, handles multi-word
  terms, and skips -leave-outs.
- **A suggestion replaces the matched term** in Search for (it never adds
  words) and runs the search. At most 4 chips.
- **The table goes to Kc for review before the chips UI is built.**

## 3. Tests
- **share:**
  - round trip (é & " #, leave-out phrases, view, stores, price, condition,
    format);
  - defaults left out;
  - location only when ticked;
  - partial and garbage hashes are safe.
- **keywords:**
  - case and punctuation; multi-word terms;
  - -leave-outs skipped;
  - a suggestion replaces the term and adds nothing;
  - unknown terms give no suggestions;
  - every entry has a meaning and an alternate; no duplicate terms.
- Existing tests stay green; any expectation that changes is named in
  LOG.md.

## 4. Checks
- Built-in browser at 1280 and 400 px.
- Kc's by-eye steps:
  - copy a link and open it in a private window;
  - with and without location;
  - chips for "russell wilson rc" and "mcm dresser";
  - no chips for a search with no known terms.
- LOG.md and a commit message.
