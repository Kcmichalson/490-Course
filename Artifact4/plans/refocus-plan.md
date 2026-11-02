# Plan: refocus on links, "Open all", record-form hint, default stores

Approved 2026-11-01 (Session 1). Default stores: Kc chose eBay, Facebook
Marketplace and Mercari on, the other seven off.

## Context
Kc's decision: the app's main job is turning one search and its filters
into correctly filtered links for many resale sites, opened in tabs. Price
recording (M3) stays as an optional notebook, and live prices (M5) are
dropped. Three changes come with it: "Open all", a one-line hint on the
record form (Kc found "Record a price" unclear), and new default stores.

## 1. Docs
- **SPEC section 1:** add the decision (main function = filtered links
  opened in tabs; price recording is an optional notebook; live prices
  declined).
- **SPEC section 5, "Opening many tabs":** rewrite for "Open all". It
  works when pop-ups are allowed for the site; otherwise a message
  explains how to allow them, and "Open next" stays as the fallback.
- **SPEC section 6, M5:** "considered and declined (2026-11-01)", with
  the reasons:
  - eBay's sold-price data is restricted;
  - Facebook Marketplace and Mercari have no public API;
  - an API key needs a server, which a static GitHub Pages site can't
    provide.
- **SPEC section 2:** add the default-stores decision.
- **LOG.md:** a decision entry for all of the above; the prompt log; the
  Open all results (both blocked and allowed) once Kc has checked them.

## 2. "Open all" (src/ui/results.js + new src/core/open-all.js)
- **Button:** "Open all (14)" next to "Open next" in the results head.
- **Pure helper:** `openAll(links, openTab)` in src/core/open-all.js
  calls `openTab(url)` for each link in "Open next" order and returns
  `{ opened: [urls], blocked: [urls] }`. It's tested in Node with a fake
  `openTab`. Plus `openAllMessage(opened, blocked)` for the wording.
- **Detecting a block:** `window.open(url, "_blank", "noopener")` always
  returns null, so it can't show whether the browser blocked the tab. The
  UI instead opens without that feature and sets `opener = null` on each
  tab it gets back. That keeps the same protection, and null now means
  "blocked".
- **Opened tabs** are marked "Opened", like "Open next" does. If any were
  blocked, the results head shows how to allow pop-ups in Chrome and
  Edge, and suggests Open next.
- **"Open next"** is unchanged, so it still works as the fallback.

## 3. Record-form hint (src/ui/saved-list.js)
The first line of the "Record a price" form reads: "Write down a price you
saw on a store page. The app keeps your notes so you can compare later; it
doesn't read prices itself."

## 4. Default stores (src/core/prefs.js)
- `DEFAULT_STORES_ON = ["ebay", "facebook", "mercari"]`.
  `defaultPrefs(siteIds)` turns off every other store.
- `parsePrefs` keeps any stored `storesOff` exactly as remembered, so
  existing choices don't change. Defaults apply only when nothing is
  stored, or storage is bad.
- prefs tests that assume the old default are updated and named in
  LOG.md.

## 5. Tests
- **New tests/open-all.test.js:** all opened; all blocked; first opened,
  rest blocked; the message wording; order.
- **prefs.test.js:** the new defaults; stored choices unchanged; corrupt
  storage → the new defaults.

## 6. Checks
- Tests pass.
- Built-in browser, with `window.open` stubbed: Open all both ways; the
  hint; fresh and existing prefs; 1280 and 400 px.
- Kc's by-eye checklist: Open all with pop-ups blocked, then allowed; the
  hint; default stores in a private window; ~400 px.
- Then LOG.md, a commit message, and tick M3 after Kc's check.
