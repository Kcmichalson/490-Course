// Entry point: loads remembered choices, wires the search form (Search for,
// Leave out, Current / Sold), the sidebar and the results together, and
// saves choices on every change.

import { SITES, SITE_IDS, buildLinks, storesWithoutView } from "./core/sites/index.js";
import { buildSearch } from "./core/query.js";
import { PREFS_VERSION, VIEWS, parsePrefs, serializePrefs } from "./core/prefs.js";
import { loadPrefsText, savePrefsText } from "./ui/storage.js";
import { initSearchBar } from "./ui/search-bar.js";
import { initSidebar } from "./ui/sidebar.js";
import { initResults } from "./ui/results.js";

const prefs = parsePrefs(loadPrefsText(), SITE_IDS);
let words = ""; // the last words searched (not remembered between visits)
let view = prefs.view; // "asking" (current listings) or "sold"

const results = initResults(document.getElementById("results"));
const sidebar = initSidebar({ sites: SITES, prefs, onChange: update });
initSearchBar({
  onSearch(text) {
    words = text;
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

update(sidebar.read());

function update(filters) {
  savePrefsText(serializePrefs({
    version: PREFS_VERSION,
    storesOff: filters.storesOff,
    condition: filters.condition,
    format: filters.format,
    location: filters.location,
    exclude: filters.exclude,
    category: filters.category,
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
  results.render({
    words: search.words,
    exclude: search.exclude,
    view,
    selectedCount: selected.length,
    missing: storesWithoutView(selected, view),
    links: search.words ? buildLinks(search, selected, new Date(), view) : [],
  });
}
