# M1 plan: Search builder

Approved 2026-11-01 (Session 1), with Kc's changes:
- Build in two parts. **M1a**: query.js, prefs.js, storage, search bar,
  sidebar, results UI, and three adapters (eBay, Mercari, Craigslist), then
  stop for Kc's by-eye check. **M1b**: the other seven adapters.
- Kc runs the 20 URL checks (section 4) while M1a is built. No parameter
  marked unconfirmed or disputed is finalized until Kc's results are in.
- Check 21 added: eBay's "used" filter on "mid century dresser".
- Defaults accepted for every open question (section 8).

Defaults come from SPEC sections 4–5 and Kc's decisions (SPEC section 2).
Dad's feedback is gathered at the M4 hand-over.

## 1. File layout
```
index.html, style.css          style.css grows; all colors stay in :root
src/main.js                    entry: load prefs, render, wire events
src/core/sites/index.js        adapters in SPEC section 5 order; buildLinks()
src/core/sites/{ebay,mercari,craigslist}.js                       (M1a)
src/core/sites/{facebook,offerup,etsy,poshmark,shopgoodwill,
                amazon,walmart}.js                                (M1b)
src/core/query.js              words and quoted phrases, exclude list, price
                               checks and quick ranges, ZIP/city cleanup,
                               applied/skipped and the filter label
src/core/categories.js         category-hint suggestions (stores, exclusions)
src/core/prefs.js              pure: default prefs, parse/serialize
src/ui/storage.js              localStorage "pc:prefs", wrapped in try/catch
src/ui/search-bar.js, src/ui/sidebar.js, src/ui/results.js
tests/query.test.js, prefs.test.js, registry.test.js, <site>.test.js
```
Node v24 runs these `.js` ES modules without a package.json.

## 2. Adapter contract
```js
export default {
  id: "craigslist", name: "Craigslist",
  lastChecked: null,                     // ISO date of Kc's by-eye check
  views: ["asking"],                     // or ["sold", "asking"]
  supports: { exclude: true, price: true, condition: ["new", "used"],
              format: [], location: "city+zip+radius" },
  notes: { sold: "", asking: "" },
  unconfirmed: ["…(check N)"],           // params awaiting Kc's check
  buildUrl(search, view, today) -> { url, applied: [...], skipped: [...], note? },
};
```
(`note` added during M1a: a per-link note that replaces the site's note,
e.g. Craigslist's "No Craigslist city set".)
- `applied` = filters he set that the link carries; `skipped` = filters he
  set that it can't. The button text comes from them ("All filters",
  "Price and location only (can't do condition)"). Filters left at "any"
  aren't mentioned.
- URLs are built with `URL`/`URLSearchParams` (é & " # encoded one way).
- Each adapter's header comment lists the site features it relies on,
  sources, and confidence.

## 3. Site mapping (from research, 2026-11-01)
| Site | Sold view | Price | Condition (new / used) | Format | Location | Exclude, quotes | Sort |
|---|---|---|---|---|---|---|---|
| eBay | `LH_Sold=1&LH_Complete=1`; note "Sign in to eBay to see sold prices" | `_udlo/_udhi` | `1000\|1500` / `3000\|2750\|4000` | `LH_Auction=1` / `LH_BIN=1` | `_stpos` ZIP; radius `_sadis` + `LH_PrefLoc=99` **unconfirmed** | `-word`, quotes kept | sold `_sop=13` **unconfirmed**; asking `_sop=10` |
| Mercari | `itemStatuses=2-3` vs `status=sold_out` **disputed** | `priceMin/priceMax` | `1` / `2,3,4,5` | none | none | none; quotes stripped | asking `sortBy=created_time` |
| Facebook | none | `minPrice/maxPrice` | `new` / `used_like_new,used_good,used_fair` | none | city slug in path; blank = his account's location | none | `sortBy=creation_time_descend` |
| Craigslist | none | `min_price/max_price` | `10` / `20,30,40,50` **unconfirmed** | none | `{city}.craigslist.org` + `postal` + `search_distance`; no city = `www` **unconfirmed** | `-word`, quotes kept (official help) | `sort=date` |
| OfferUp | none | `price_min/price_max` | none | none | `radius`; `location=ZIP` **disputed** | none | `sort=-posted` |
| Etsy | none | `min/max` | none | none | none | none | `order=most_recent` |
| Poshmark | `availability=sold_out` | **unknown** | `closet_nwt` / none | none | none | none | `sort_by=just_in` |
| ShopGoodwill | closed auctions `sca/caed/cadb` **unconfirmed** | `lp/hp` | none | buy-now **unconfirmed** | none | quotes stripped | `col/desc` **unconfirmed** |
| Amazon | none | `rh=p_36:<cents>-<cents>` | none | none | none | none | `s=date-desc-rank` |
| Walmart | none | `min_price/max_price` | none | none | none | none | `sort=new` |

Until Kc's checks are in, unconfirmed params are provisional: listed in the
adapter's `unconfirmed` array, `lastChecked` stays null, and no exact
("golden") URL test is written for them. A param that fails a check becomes
"skipped" (or the site becomes "Asking now only").

## 4. URL checks (Kc, by eye)
Query "russell wilson foil card" unless noted. "Paste URL" = set the filter
with the site's own controls and paste the address bar.

1. eBay sold: https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card&LH_Sold=1&LH_Complete=1&_sop=13
2. eBay filters: https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card+-lot+-reprint&_udlo=5&_udhi=50&LH_ItemCondition=3000%7C2750%7C4000&LH_BIN=1&_sop=10
3. eBay radius: set "Distance from ZIP" in eBay's sidebar; paste URL
4. Mercari sold A: https://www.mercari.com/search/?keyword=russell%20wilson%20foil%20card&itemStatuses=2-3
5. Mercari sold B: https://www.mercari.com/search/?keyword=russell%20wilson%20foil%20card&status=sold_out
6. Mercari filters: https://www.mercari.com/search/?keyword=russell%20wilson%20foil%20card&priceMin=5&priceMax=50&itemConditions=2,3,4,5&sortBy=created_time
7. Facebook: https://www.facebook.com/marketplace/search/?query=russell%20wilson%20foil%20card&minPrice=5&maxPrice=50&itemCondition=used_like_new,used_good,used_fair&sortBy=creation_time_descend
8. Craigslist, no city: https://www.craigslist.org/search/sss?query=russell+wilson+foil+card
9. Craigslist used: https://seattle.craigslist.org/search/sss?query=russell+wilson+foil+card+-lot&min_price=5&max_price=50&condition=20&condition=30&condition=40&condition=50&sort=date
10. Craigslist new: as 9 with only `condition=10`
11. OfferUp: https://offerup.com/search?q=russell+wilson+foil+card&price_min=5&price_max=50&sort=-posted
12. OfferUp location: set location and distance on the site; paste URL
13. Etsy: https://www.etsy.com/search?q=russell+wilson+foil+card&min=5&max=50&order=most_recent
14. Poshmark sold: https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&availability=sold_out
15. Poshmark NWT: https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&condition=closet_nwt (then set a price filter; paste URL)
16. ShopGoodwill active: https://shopgoodwill.com/categories/listing?st=russell%20wilson%20foil%20card&lp=5&hp=50
17. ShopGoodwill closed: on https://shopgoodwill.com/search/advancedsearch choose Closed Auctions, $5–$50; paste URL
18. Amazon: https://www.amazon.com/s?k=russell+wilson+foil+card&rh=p_36%3A500-5000&s=date-desc-rank
19. Walmart: https://www.walmart.com/search?q=russell+wilson+foil+card&min_price=5&max_price=50&sort=new
20. Special characters: https://www.ebay.com/sch/i.html?_nkw=pok%C3%A9mon+%22black+%26+white%22+%2325
21. eBay used on furniture: https://www.ebay.com/sch/i.html?_nkw=mid+century+dresser&LH_ItemCondition=3000%7C2750%7C4000&_sop=10
    (does the condition filter show "Used" and return used dressers, not an
    empty or odd page, given 2750/4000 are card-specific codes?)

Added during M1b (not in the approved list; covers params no check
reached):
22. Facebook city and "new": https://www.facebook.com/marketplace/seattle/search/?query=mid%20century%20dresser&itemCondition=new&sortBy=creation_time_descend
    (Seattle results, condition "New")
23. Amazon min price only: https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_36%3A2000-&s=date-desc-rank
    (price filter shows $20 and up)

Added after Kc's pasted URLs for checks 3, 12, 15 and 17:
24. Poshmark price, any range and one end only (check 15 used $25–$50):
    a. https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&price%5B%5D=5-50 ($5–$50)
    b. https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&price%5B%5D=20- ($20 and up)
    c. https://poshmark.com/search?query=russell%20wilson%20foil%20card&type=listings&price%5B%5D=-20 (up to $20)
25. ShopGoodwill short closed-auction link (today's date as M/D/YYYY):
    https://shopgoodwill.com/categories/listing?st=russell%20wilson%20foil%20card&lp=5&hp=50&sca=true&caed=11%2F1%2F2026&cadb=30
    (closed auctions, $5–$50)
26. eBay location link from the app (any ZIP; 98101 shown):
    https://www.ebay.com/sch/i.html?_nkw=russell+wilson+foil+card&_stpos=98101&_sadis=25&_fspt=1&_sop=10
    (a "25 miles from 98101" chip)
27. Amazon max price only: https://www.amazon.com/s?k=star+wars+black+series+figure&rh=p_36%3A-2000&s=date-desc-rank
    (price filter shows up to $20)

Checks 22 and 23 passed (Kc, 2026-11-01).

Checks 26 and 27 passed (Kc, 2026-11-01). Check 25 showed only grey
placeholder cards for "russell wilson foil card": either no closed
auctions match, or the short link doesn't work with search words (check
17's own URL had no words). To tell which, open both with a common word:
- 25b short link: https://shopgoodwill.com/categories/listing?st=lamp&lp=5&hp=50&sca=true&caed=11%2F1%2F2026&cadb=30
- 25c check 17's full URL with st=lamp: https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=5&hp=50&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=
25b shows closed lamps → the short link works. Only 25c works → the app
switches to the full form. Neither works → ShopGoodwill becomes Asking-only.

**Result:** checks 24a–c passed. 25b showed nothing and 25c worked, so the
app's ShopGoodwill Sold link now uses check 17's full query.
28. ShopGoodwill Sold with no price set: in the app, search "star wars black
    series figure" with Min and Max blank and click ShopGoodwill (Sold).
    You should see closed auctions (the link has `lp=&hp=`).

**Check 28 result (2026-11-01):** Kc reported "works", but the screenshot
shows the search box empty, "Showing 1 to 40 of 711815 entries", and live
auctions (47 s left, "Quick Bid"). So the words and the closed filter were
both ignored, and check 28 failed. To find which form works with no price,
all with "lamp" (25c showed lamp has closed auctions):
- 28b, as the app builds it now (`lp=&hp=`): https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=&hp=&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=
- 28c, `lp=0&hp=999999` (a guess at the site's "any price"): https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=0&hp=999999&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=
- 28d, lp and hp left out: https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=
Pass = the search box says "lamp" and the items are ended auctions (no
countdown, no "Quick Bid"). The app uses whichever of 28c/28d passes. If
28b also passes, the star wars result just had no closed auctions and the
page fell back to everything.

**Result:** only 28c kept "lamp". 28b and 28d dropped the search term. So
the Sold link now uses `lp=0&hp=999999` when no price is set (and 0 or
999999 for an unset end). Two last ShopGoodwill checks:
29. Asking with no price (the app's short form): https://shopgoodwill.com/categories/listing?st=lamp
    (the search box says "lamp" and the results are lamps)
30. Sold with a minimum only ($20 and up): https://shopgoodwill.com/categories/listing?st=lamp&sg=&c=&s=&lp=20&hp=999999&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=true&caed=11%2F1%2F2026&cadb=30&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=true&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=
    (the search box says "lamp" and the items are ended auctions at $20 or more)

**Result:** 30 passed. 29 (the short Asking link, no price) stalled the
page, so the Asking link now always sends lp and hp, with 0 / 999999 for
an unset end, like the Sold link:
31. Asking with no price: https://shopgoodwill.com/categories/listing?st=lamp&lp=0&hp=999999
    (the search box says "lamp" and the results are live lamp listings)
If 31 also stalls, the Asking link would use check 17's full query with
`sca=false`; that would need one more check.

**Result:** 31 stalled too. Kc pasted the URL from searching "Lamp" by
hand (check 32): the full query with `sca=false&cadb=7&sus=false&ihp=true`.
The Asking link now copies it exactly when no price is set, and when only
one end is set. With both ends set it keeps check 16's short form.
33. Asking with a minimum only: https://shopgoodwill.com/categories/listing?st=Lamp&sg=&c=&s=&lp=20&hp=999999&sbn=&spo=false&snpo=false&socs=false&sd=false&sca=false&caed=11%2F1%2F2026&cadb=7&scs=false&sis=false&col=1&p=1&ps=40&desc=false&ss=0&UseBuyerPrefs=true&sus=false&cln=1&catIds=&pn=&wc=false&mci=false&hmt=false&layout=grid&ihp=true
    (live lamp listings at $20 or more)

**Check 33 passed. M1 complete (2026-11-01):** all ten adapters checked,
none with unconfirmed params.

Results go in LOG.md; each adapter's `lastChecked` gets the check date.

**Results (2026-11-01):** Kc reported checks 1–21 all pass. Checks 3, 12, 15
and 17 still need their pasted URLs. Both Mercari sold URLs (4, 5) passed, so
the app keeps `itemStatuses=2-3`. In M1b, a filter that depends on one of
those pasted URLs is left out (and shows as "can't do") rather than
guessed: OfferUp location (12), Poshmark price (15), ShopGoodwill sold view
(17). eBay's radius (3) was already in M1a's code and stays provisional.

**Pasted URLs (2026-11-01):** eBay radius = `_stpos` + `_sadis` + `_fspt=1`
(no `LH_PrefLoc`). OfferUp: changing location or distance doesn't change
the URL, so OfferUp location stays "can't do", with a note. Poshmark price =
`price[]=<min>-<max>`. ShopGoodwill closed = `sca=true&caed=<M/D/YYYY>&cadb=30`
on the same listing path. Each is in the app now; checks 24–26 confirm the
app's shorter or generalized forms.

## 5. UI
- Search bar on top; sidebar left. Under ~760 px a "Filters" button opens
  the sidebar as a panel above the results.
- Sidebar (`<details>` sections): Stores (checkboxes, All, None); Price
  (min/max, Under $20, $20–$50, Over $50); Condition; Buying format;
  Location (ZIP, radius 5/10/25/50/100 mi, Craigslist city, Facebook city:
  all blank by default and remembered; a city field shows only once its
  site's adapter exists); Exclude words; Category hint (a suggestion line
  with "Use these"; never changes the search words).
- Results: "Sold for" group, then "Asking now", each a new-tab link per
  store, labeled Sold or Asking, with the filter text and any note.
  Filter changes refresh the links.
- "Open next": opens the first link not yet opened (one tab per click),
  shows "Next: eBay (Sold), 1 of 6", marks opened links. What the browser
  allows goes in LOG.md.
- Remembered in `pc:prefs`: stores turned off (so sites added later start
  on), condition, format, location, exclude words, category. Not
  remembered: search words, price.

## 6. Tests (`node --test "tests/*.test.js"`)
- Per adapter: plain words; exclusions; price range; new and used; buying
  format; location (local sites); é & " # round-trip through `new URL()`;
  sold vs asking; unsupported filters land in `skipped`. The exact URL test
  is added once Kc confirms that site's URLs.
- Registry: SPEC order, unique ids, `lastChecked` null or ISO date, https
  links on the right host, no crash on an empty search, `supports` matches
  what `buildUrl` applies. M1b adds "exactly 10 adapters".
- Query: quoted phrases (including phone curly quotes), exclude list
  cleanup, price checks (min above max, negatives, blanks, decimals),
  quick ranges, ZIP and city cleanup, label wording.
- Prefs: defaults, round trip, corrupt JSON -> defaults, unknown store ids
  dropped, bad values replaced by defaults.

## 7. By-eye checks (Kc's browser, http://127.0.0.1:8004)
- ~1280 px: search "russell wilson foil card" with $5–$50 and Used; both
  groups appear with the right filter text; three buttons open the right
  searches in new tabs; "Open next" three times gives three tabs; None,
  then All; reload and the choices are remembered.
- ~400 px: no sideways scroll; Filters opens and closes the panel; nothing
  clipped or covered.
- The three test searches: "russell wilson foil card", "star wars black
  series figure", "mid century dresser" (Seattle as the test location).

## 8. Decisions on the open questions (defaults accepted)
1. eBay "used" includes graded (2750) and ungraded (4000); check 21 tests it
   on furniture.
2. Fixed-price-only sites stay listed when auction/buy-now is set, marked
   as not applying the buying format.
3. Quoted phrases kept for eBay and Craigslist, stripped elsewhere.
4. ShopGoodwill "sold" = closed auctions from the last 30 days, labeled
   "Sold (closed auction)".
5. "Open next" order: Sold for first, then Asking now, in SPEC site order.
6. Facebook with no city uses the path without a city.
7. Radius choices 5/10/25/50/100 mi (default 25); phone breakpoint ~760 px.
8. TCGplayer and Chairish stay out of M1.

Category hints (Kc's decision): Cards: eBay, Mercari, ShopGoodwill; exclude
"lot, reprint, custom". Toys and figures: eBay, Mercari, Etsy, ShopGoodwill;
exclude "lot, broken". Furniture: Facebook, Craigslist, OfferUp; exclude
"parts, broken".

Suggested extras (not in M1): a "copy link" button per site; a "report a
broken link" note field.
