# Price Check: Specification (v0)

## 1. Purpose
My dad wants an easier way to find out what things are worth on resale
sites: trading cards, plushies, action figures, furniture, anything. Today
he has to search each site by hand, retype the search, and remember each
site's filters (especially "sold").

Price Check is a mass-search tool. He types a search once and the app
opens it on every selected store, each written in that store's own URL
format, from one click ("Open all"). He can type the search two ways:
- **in one line, in standard form:** `russell wilson foil card -rerun
  -reprint` (words must all match, "quoted phrases" stay together, and
  -words are left out);
- **or in two boxes:** "Search for" (everything he wants) and "Leave out"
  (everything that shouldn't appear, separated by commas).

A switch picks which listings the links open: **Current listings** (what's
for sale now) or **Sold listings** (what things actually sold for, on the
stores that show them).

**Main function (my decisions, 2026-11-01):** the app's main job is
translating one search and its filters into correctly filtered links for
many resale sites, opened in tabs. In the retrofit (later the same day),
saved searches (M2) and recorded prices (M3) were removed to keep the app
on that one job. Showing live prices inside the app (M5) was considered
and declined (see "Declined: live prices" in section 6).

Artifact 4 requirements this covers: built for someone outside the team
(my dad), his needs found out by asking him when he tries it at the M4
hand-over (section 2 holds my starting decisions), a log of plans and
changes (LOG.md), and a hand-over before Sunday, November 8 (section 9).
Solo work was confirmed as allowed by my professor.

## 2. What my dad needs (my decisions, 2026-11-01)
There's no up-front interview. These are my decisions, not his answers;
his feedback comes at the M4 hand-over.

| Topic | My decision |
|---|---|
| Test searches for M1 | "russell wilson foil card", "star wars black series figure", "mid century dresser" |
| Location (ZIP, Craigslist city, Facebook city) | Blank by default; entered by the user and remembered. Seattle is used only for testing |
| eBay sold links (eBay now asks for sign-in) | Keep them, with the note "Sign in to eBay to see sold prices" |
| Category hints | Removed in M4 (Dad: "category hint seems to be useless.") |
| Sites | The ten in section 5, plus Mercari Japan (added in M4 at my request) |
| Default stores (no remembered choices yet) | eBay, Facebook Marketplace and Mercari on; the others off. Remembered choices stay as they are; a store added later starts off |

At the M4 hand-over my dad tries the app; record what he liked, what
confused him, and what he'd change, in his words, in LOG.md.

## 3. Constraints
- Static site on GitHub Pages; no server, no build step (see CLAUDE.md)
- The app builds search links only. No scraping, no fetching other sites'
  pages, no API keys. Prices are seen on each site's own results page,
  opened in a new tab
- Site URL formats can change without notice, so each site is one small,
  tested adapter with a "last checked" date
- His remembered choices stay in his browser (localStorage, `pc:` prefix).
  Nothing else is stored

## 4. Search bar and filter sidebar
Layout like eBay's results page: a search bar on top, a filter sidebar on
the left (a collapsible panel on phones), and the site results on the right.

**Search form** (top of the page):
- **Search for** (required): e.g., `russell wilson foil card -reprint`.
  Words must all match; "quoted phrases" stay together; `-word` and
  `-"a phrase"` are left out
- **Leave out** (optional): e.g., `lot, reprint, base set`. Separated by
  commas, so an item with spaces is a phrase. Remembered between visits
- Leave-outs from both boxes are combined, each once. The results show
  what was understood: "Searching for … · Leaving out: …"
- **Current listings / Sold listings** switch, remembered. Sold shows only
  the stores with a sold view and lists the others as "No sold view"

**Filter sidebar** (sections collapse, like eBay's):
- **Stores:** a checkbox per site (section 5), with "All" and "None".
  Default: eBay, Facebook Marketplace and Mercari on (section 2). His
  choice is remembered
- **Price:** min and max, plus quick ranges (under $20, $20–$50, over $50)
- **Condition:** any / new / used
- **Buying format:** any / auction / buy now (only some sites support it)
- **Location:** ZIP code or city and a radius, for local sites

**Filters a site can't do:** each site applies only the filters it
supports. Every site button shows which filters it applied ("eBay: all
filters" / "Craigslist: price and location only"), so he never assumes a
filter worked where it didn't.

Query formatting rules (per site, in the adapters):
- Use each site's own exclude, exact-phrase, condition, price, format, and
  location syntax where it exists. Only eBay and Craigslist can leave words
  out in a link; a phrase is written `-"base set"` there. The other stores
  say "can't do exclude words"
- Leave out fields a site handles badly instead of making results worse
- Sort by "recently sold" or "newest" where the site allows it

## 5. Sites (the ten I chose; see section 2)
| # | Site | Asking now | Sold for | Best for | Local? |
|---|---|---|---|---|---|
| 1 | eBay | Yes | Yes (sold filter) | Almost everything; the main price reference | Optional radius |
| 2 | Mercari | Yes | To verify (sold filter) | Toys, collectibles, clothing | No |
| 3 | Facebook Marketplace | Yes | No | Furniture, big items; may need him logged in | Yes |
| 4 | Craigslist | Yes | No | Furniture, local deals; city-based | Yes |
| 5 | OfferUp | Yes | No | Local and shipped items | Yes |
| 6 | Etsy | Yes | No | Handmade, vintage, plushies | No |
| 7 | Poshmark | Yes | To verify (sold filter) | Clothing, some toys and decor | No |
| 8 | ShopGoodwill | Yes | To verify | Secondhand auctions of everything | No |
| 9 | Amazon | Yes | No | New retail price as a reference point | No |
| 10 | Walmart | Yes | No | New retail price as a reference point | No |
| 11 | Mercari Japan (M4) | Yes | Yes (sold filter, to verify) | Japanese listings; words sent as typed (no translation); off by default | No |

Optional extras by category, off by default: TCGplayer (trading card
games), Chairish (furniture and decor).

Every "To verify" is checked in M1 by building the link and opening it; if
a sold view doesn't work by link, that site is "Asking now" only. Rules for
adding a site: its results open from a link, using it needs no scraping, and
its terms allow linking to searches.

The results show one link per selected store for the chosen view, each
labeled "Sold" or "Asking", so he never mistakes an asking price for a sale
price.

**Opening many tabs:** an "Open all" button opens every selected link from
one click. Browsers block a page from opening several tabs at once unless
pop-ups are allowed for that site, so when tabs are blocked the app says
how many and explains how to allow pop-ups for this site in Chrome and
Edge. "Open next" stays as the fallback: it walks through the links one
click at a time, which browsers always allow, and names the next store
("Open next: eBay"). Since M4 the app doesn't mark which links were
already opened (Dad: "why does it say when stuff is already opened?").
What his browser does with pop-ups blocked and allowed is recorded in
LOG.md.

## 6. Milestones

### M0: Setup (no app code)
- Folder, CLAUDE.md, settings, hook, serve.py in place
- Guardrail check: the agent tries each denied action against harmless
  targets and each is refused (LOG.md "M0 checks")
- Section 2 filled with my decisions (no up-front interview); site list in
  section 5 confirmed

Checks: every deny test refused; `py serve.py` serves a placeholder page at
http://127.0.0.1:8004; section 2 has my decisions.

### M1: Search builder
- The search bar and the filter sidebar (section 4), except memberships
- Ten adapters in src/core/sites/ (section 5), each declaring which filters
  it supports, with tests of the URLs it builds for: plain words,
  exclusions, a price range, condition, buying format, a location (local
  sites), and special characters (é, &, quotes, #)
- Results grouped as **Sold for** and **Asking now**, one button per
  selected store, each showing which filters it applied; each opens that
  site's search in a new tab; "Open next" walks through them
- Store choices and filter defaults remembered between visits
- Works at phone and desktop widths (sidebar collapses on phones)

Checks: tests pass; every "To verify" in section 5 resolved and recorded;
by eye, the three test searches in section 2: each link opens the right
search with the filters applied; visual pass at ~1280 and ~400 px.

### M2: Saved searches (built, then removed in the retrofit, 2026-11-01)
Saved searches, "My memberships" and export/import were built and checked
(plans/m2-plan.md), then removed when the app was refocused on mass search
(section 1).

### M3: Recording prices (built, then removed in the retrofit, 2026-11-01)
Recording prices on saved searches was built and checked
(plans/m3-plan.md), then removed with M2.

### Retrofit: mass search (2026-11-01)
- Two inputs: "Search for" (understands -words and "phrases") and "Leave
  out" (commas)
- Current / Sold switch in place of the two result groups
- "Open all" plus "Open next"
- M2 and M3 removed

Checks: tests for the query parsing, views and phrase leave-outs; check 35
(phrase leave-outs on eBay and Craigslist); by eye at ~1280 and ~400 px
(plans/retrofit-plan.md).

### M4: Hand-over and one round of fixes
- Show it to my dad (in person or a call); watch him use it without help
- Record his feedback in LOG.md; fix the top items that fit the time left
- Short "How to use it" help on the page

Checks: his feedback recorded; fixes logged with how they were verified.

Done in M4 (plans/m4-plan.md):
- category hint removed;
- "opened" tracking removed;
- Mercari Japan added (my request);
- "How to use it" help;
- Open all message mentions reloading.

### M5: shareable search links and a keyword helper (2026-11-07)
- **Shareable link:** the app's address holds the current search after "#"
  (never sent to the server):
  - Search for, Leave out, Current/Sold, the selected stores, price,
    condition and buying format;
  - location only with "Include my location" (unticked each visit).
  - "Copy link" copies it and shows "Link copied." Opening a link fills in
    the search and filters and builds the links; they're saved as usual.
    A broken or partial link fills in what it can.
- **Keyword helper:** a built-in word list (src/core/keywords.js; no
  network, no AI) of listing abbreviations, jargon, synonyms and common
  misspellings, grouped by cards, toys and figures, furniture and general.
  - Each entry has a meaning and at least one alternate that real listings
    use.
  - When the search contains a known term, chips under the search bar
    offer alternate searches ("Try: russell wilson rookie card"). A chip
    replaces the term and runs the search; it never adds words.

Checks: tests for the link round trip, garbage links, location only when
ticked, keyword matching and replacement, and the word list; by eye at
~1280 and ~400 px (plans/m5-plan.md).

### Declined: live prices (formerly M5; considered and declined, 2026-11-01)
Showing live prices in the app itself was considered and declined (my
decision). The reasons:
- eBay's sold-price data is restricted, so an eBay API would show asking
  prices only, not what things sold for.
- Facebook Marketplace and Mercari have no public API.
- Any API key needs a server to keep it secret (a static GitHub Pages site
  can't), which this project's rules exclude.

The app stays a link builder (section 1); he reads prices on each site's
own page.

### Stretch (only if time remains; each needs its own plan)
- Exclusion presets per category (e.g., furniture: "parts, broken")
- Anything from his M4 hand-over feedback that ranks high

## 7. Out of scope
- Scraping or fetching any site's results; alerts for new listings
- Saved searches, recorded prices and memberships (removed in the retrofit)
- Accounts and syncing between devices

## 8. Open questions
- Which sites he actually uses (ask at the M4 hand-over)
- Whether Facebook Marketplace links work well for him without extra steps
  (M4 hand-over)
- The final name

## 9. Schedule (due Sunday, November 8, 11:59 PM)
- Nov 1: check-in card on my portfolio; M0 setup
- Nov 1–2: M1
- Nov 1: M2 and M3 built, then the retrofit to mass search (M2/M3
  removed)
- Nov 6–7: hand-over to my dad, M4 fixes
- Nov 8: final log, portfolio card, submit
