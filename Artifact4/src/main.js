// Entry point: loads remembered choices, wires the search bar, sidebar and
// results together, and saves choices on every change.

import { SITES, SITE_IDS, buildLinks } from "./core/sites/index.js";
import { buildSearch } from "./core/query.js";
import { PREFS_VERSION, parsePrefs, serializePrefs } from "./core/prefs.js";
import { loadPrefsText, savePrefsText } from "./ui/storage.js";
import { initSearchBar } from "./ui/search-bar.js";
import { initSidebar } from "./ui/sidebar.js";
import { initResults } from "./ui/results.js";

const prefs = parsePrefs(loadPrefsText(), SITE_IDS);
let words = ""; // the last words searched (not remembered between visits)

const results = initResults(document.getElementById("results"));
const sidebar = initSidebar({ sites: SITES, prefs, onChange: update });
initSearchBar({
  onSearch(text) {
    words = text;
    update(sidebar.read());
  },
});
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
  }));

  const search = buildSearch({ words, ...filters });
  const { min, max, swapped } = search.price;
  sidebar.setMessage("price-message", swapped ? `Min was more than max, so using $${min}–$${max}.` : "");
  sidebar.setMessage("zip-message",
    filters.location.zip.trim() && !search.location.zip ? "A ZIP code is 5 digits; this one is skipped." : "");

  const selected = SITE_IDS.filter((id) => !filters.storesOff.includes(id));
  results.render({
    words: search.words,
    selectedCount: selected.length,
    links: search.words ? buildLinks(search, selected) : [],
  });
}
