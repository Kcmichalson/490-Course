// Entry point: loads remembered choices, wires the search form (Search for,
// Leave out, Current / Sold), the sidebar and the results together, saves
// choices on every change, and keeps the shareable link in the address bar
// (M5).

import { SITES, SITE_IDS, buildLinks, storesWithoutView } from "./core/sites/index.js";
import { buildSearch } from "./core/query.js";
import { PREFS_VERSION, VIEWS, parsePrefs, serializePrefs } from "./core/prefs.js";
import { decodeShare, encodeShare, linkSettings } from "./core/share.js";
import { findSuggestions } from "./core/keywords.js";
import { loadPrefsText, savePrefsText } from "./ui/storage.js";
import { initSearchBar } from "./ui/search-bar.js";
import { initSidebar } from "./ui/sidebar.js";
import { initResults } from "./ui/results.js";
import { initSuggestions } from "./ui/suggestions.js";

const prefs = parsePrefs(loadPrefsText(), SITE_IDS);
let words = ""; // the last words searched (not remembered between visits)
let view = prefs.view; // "asking" (current listings) or "sold"
let includeLocation = false; // "Include my location" (unticked each visit)

const results = initResults(document.getElementById("results"), {
  onCopyLink: copyLink,
  onIncludeLocation(checked) {
    includeLocation = checked;
    update(sidebar.read());
  },
});
const sidebar = initSidebar({ sites: SITES, prefs, onChange: update });
const searchBar = initSearchBar({
  onSearch(text) {
    words = text;
    update(sidebar.read());
  },
});
// A chip is an alternate search: it replaces Search for and runs it.
const suggestions = initSuggestions(document.getElementById("suggestions"), {
  onPick(text) {
    words = text;
    searchBar.setWords(text);
    update(sidebar.read());
  },
});

// Current listings / Sold listings switch.
const viewButtons = [...document.querySelectorAll(".view-switch [data-view]")];
for (const button of viewButtons) {
  button.addEventListener("click", () => {
    if (!VIEWS.includes(button.dataset.view)) return;
    view = button.dataset.view;
    update(sidebar.read());
  });
}

// A shared link (#q=…) fills in the search and its filters, like a normal
// change: they're saved as usual (Kc's decision, M5). Settings the link
// leaves out go to their default; the visitor's location stays unless the
// link carries one. A link pasted into this tab later works the same way.
function openLink(hash) {
  const shared = linkSettings(decodeShare(hash, SITE_IDS), SITE_IDS);
  if (!shared.words) return false;
  words = shared.words;
  searchBar.setWords(words);
  view = shared.view;
  sidebar.apply({ ...shared, storesOff: SITE_IDS.filter((id) => !shared.storesOn.includes(id)) });
  update(sidebar.read());
  return true;
}
window.addEventListener("hashchange", () => openLink(location.hash));

if (!openLink(location.hash)) update(sidebar.read());

function copyLink() {
  const link = location.href;
  const done = () => results.showShare({ status: "Link copied." });
  const fallback = () => results.showShare({ status: "Press Ctrl+C to copy.", link });
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, fallback);
  else fallback();
}

function update(filters) {
  savePrefsText(serializePrefs({
    version: PREFS_VERSION,
    knownStores: SITE_IDS,
    storesOff: filters.storesOff,
    condition: filters.condition,
    format: filters.format,
    location: filters.location,
    exclude: filters.exclude,
    view,
  }));
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  }

  const search = buildSearch({ words, ...filters });
  const { min, max, swapped } = search.price;
  sidebar.setMessage("price-message", swapped ? `Min was more than max, so using $${min}–$${max}.` : "");
  sidebar.setMessage("zip-message",
    filters.location.zip.trim() && !search.location.zip ? "A ZIP code is 5 digits; this one is skipped." : "");

  const selected = SITE_IDS.filter((id) => !filters.storesOff.includes(id));

  // Keyword chips for the words searched (M5); none for unknown terms.
  suggestions.render(findSuggestions(words));

  // The address bar always holds this search's shareable link (no reload,
  // no history entry). With no search words there's nothing to share.
  const hash = encodeShare({ ...filters, words, view, storesOn: selected }, { includeLocation });
  history.replaceState(null, "", hash || location.pathname + location.search);

  results.render({
    words: search.words,
    exclude: search.exclude,
    view,
    selectedCount: selected.length,
    missing: storesWithoutView(selected, view),
    links: search.words ? buildLinks(search, selected, new Date(), view) : [],
    share: { includeLocation },
  });
}
