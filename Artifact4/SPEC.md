# Price Check: Specification (v0)

## 1. Purpose
My dad wants an easier way to find out what things are worth on resale
sites: trading cards, plushies, action figures, furniture, anything. Today
he has to search each site by hand, retype the search, and remember each
site's filters (especially "sold").

Price Check lets him type a search once, for example
"russell wilson foil card", and opens the best search on each site for two
questions:
- **Asking now:** what it's listed for right now (active listings)
- **Sold for:** what people actually paid (sold listings), the better
  measure of value

It also keeps his saved searches as a list, with the prices he records.

**Main function (my decision, 2026-11-01):** the app's main job is
translating one search and its filters into correctly filtered links for
many resale sites, opened in tabs. Recording prices (M3) stays as an
optional notebook. Showing live prices inside the app (M5) was considered
and declined (see M5 in section 6).

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
| Category hints | Cards: eBay, Mercari, ShopGoodwill; exclude "lot, reprint, custom". Toys: eBay, Mercari, Etsy, ShopGoodwill; exclude "lot, broken". Furniture: Facebook, Craigslist, OfferUp; exclude "parts, broken" |
| Sites | The ten in section 5 |
| Default stores (no remembered choices yet) | eBay, Facebook Marketplace and Mercari on; the other seven off. Remembered choices stay as they are |

At the M4 hand-over my dad tries the app; record what he liked, what
confused him, and what he'd change, in his words, in LOG.md.

## 3. Constraints
- Static site on GitHub Pages; no server, no build step (see CLAUDE.md)
- The app builds search links only. No scraping, no fetching other sites'
  pages, no API keys. Prices are seen on each site's own results page,
  opened in a new tab
- Site URL formats can change without notice, so each site is one small,
  tested adapter with a "last checked" date
- His data stays in his browser (localStorage, `pc:` prefix) and can be
  exported/imported as a JSON file

## 4. Search bar and filter sidebar
Layout like eBay's results page: a search bar on top, a filter sidebar on
the left (a collapsible panel on phones), and the site results on the right.

**Search bar:** search words (required), e.g., "russell wilson foil card".

**Filter sidebar** (sections collapse, like eBay's):
- **Stores:** a checkbox per site (section 5), with "All" and "None".
  Default: eBay, Facebook Marketplace and Mercari on (section 2). His
  choice is remembered
- **Price:** min and max, plus quick ranges (under $20, $20–$50, over $50)
- **Condition:** any / new / used
- **Buying format:** any / auction / buy now (only some sites support it)
- **Location:** ZIP code or city and a radius, for local sites
- **Exclude words:** e.g., lot, broken, parts, reprint, custom
- **Category hint:** cards, toys and figures, furniture, other. Only
  suggests stores and exclusions; it never changes his search words
- **My memberships:** checkboxes for memberships he has (e.g., Amazon
  Prime, Walmart+), remembered. See "Memberships" below

**Filters a site can't do:** each site applies only the filters it
supports. Every site button shows which filters it applied ("eBay: all
filters" / "Craigslist: price and location only"), so he never assumes a
filter worked where it didn't.

**Memberships, honestly:** the app doesn't see prices (section 3), so a
membership can't change a price on screen. It can:
- apply a site's own member filter where one exists in the search link
  (for example, Prime-eligible items on Amazon, if the link supports it)
- show a short note on that site's button (e.g., "Prime: free shipping on
  eligible items, so compare totals")
- in M3, when he records a price, add shipping and membership effects to
  show "your total" next to the listed price

Query formatting rules (per site, in the adapters):
- Use each site's own exclude, exact-phrase, condition, price, format, and
  location syntax where it exists
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

Optional extras by category, off by default: TCGplayer (trading card
games), Chairish (furniture and decor).

Every "To verify" is checked in M1 by building the link and opening it; if
a sold view doesn't work by link, that site is "Asking now" only. Rules for
adding a site: its results open from a link, using it needs no scraping, and
its terms allow linking to searches.

The results area labels each link "Sold" or "Asking," so he never mistakes
an asking price for a sale price.

**Opening many tabs:** an "Open all" button opens every selected link from
one click. Browsers block a page from opening several tabs at once unless
pop-ups are allowed for that site, so when tabs are blocked the app says
how many and explains how to allow pop-ups for this site in Chrome and
Edge. "Open next" stays as the fallback: it walks through the links one
click at a time, which browsers always allow. What his browser does with
pop-ups blocked and allowed is recorded in LOG.md.

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

### M2: Saved searches
- Save the current search (with its filters) to a list; edit, delete
- Each saved search has its site buttons, so re-checking is one click
- Filter the list by text or category
- "My memberships" in the sidebar: remembered; applies member filters
  where a site's link supports them and shows the membership notes
- Export to a JSON file and import it back (clear message for a bad file)

Checks: tests for the data (add, edit, delete, export/import round trip,
bad file rejected); by eye: save five searches, reload, still there;
export, clear, import, back again.

### M3: Recording prices
- On a saved search, record a price he saw: amount, shipping, sold or
  asking, site, date, optional note; show "your total" with shipping and
  membership effects (e.g., Prime free shipping)
- Each saved search shows its latest sold price, latest asking price, and
  when it was last checked; sort by price or "checked longest ago"

Checks: tests for latest-price and sorting rules (including searches with
no prices); by eye with his real searches.

### M4: Hand-over and one round of fixes
- Show it to my dad (in person or a call); watch him use it without help
- Record his feedback in LOG.md; fix the top items that fit the time left
- Short "How to use it" help on the page

Checks: his feedback recorded; fixes logged with how they were verified.

### M5: prices inside the app (considered and declined, 2026-11-01)
Showing live prices in the app itself was considered and declined (my
decision). The reasons:
- eBay's sold-price data is restricted, so an eBay API would show asking
  prices only, not what things sold for.
- Facebook Marketplace and Mercari have no public API.
- Any API key needs a server to keep it secret (a static GitHub Pages site
  can't), which this project's rules exclude.

The app stays a link builder (section 1); he reads prices on each site's
own page and can note them with M3.

### Stretch (only if time remains; each needs its own plan)
- Exclusion presets per category (e.g., furniture: "parts, broken")
- A printable/shareable summary of saved searches and prices
- Anything from his M4 hand-over feedback that ranks high

## 7. Out of scope
- Scraping or fetching any site's results; alerts for new listings
- Accounts and syncing between devices (export/import covers moving data)

## 8. Open questions
- Which sites he actually uses (ask at the M4 hand-over)
- Whether Facebook Marketplace links work well for him without extra steps
  (M4 hand-over)
- The final name

## 9. Schedule (due Sunday, November 8, 11:59 PM)
- Nov 1: check-in card on my portfolio; M0 setup
- Nov 1–2: M1
- Nov 3–4: M2
- Nov 5–6: M3
- Nov 6–7: hand-over to my dad, M4 fixes
- Nov 8: final log, portfolio card, submit
