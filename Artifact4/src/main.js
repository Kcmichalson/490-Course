// Entry point: loads remembered choices and saved searches, wires the
// search bar, sidebar, results and Saved view together, and saves choices on
// every change.

import { SITES, SITE_IDS, buildLinks } from "./core/sites/index.js";
import { buildSearch } from "./core/query.js";
import { PREFS_VERSION, parsePrefs, serializePrefs } from "./core/prefs.js";
import {
  MAX_IMPORT_BYTES, IMPORT_MESSAGES,
  addSearch, updateSearch, renameSearch, deleteSearch,
  serializeSaved, parseSaved, exportText, exportFileName, parseImport, mergeImport,
} from "./core/saved.js";
import { addPrice, deletePrice, formatMoney, priceFromForm } from "./core/prices.js";
import { loadPrefsText, savePrefsText, loadSavedText, saveSavedText } from "./ui/storage.js";
import { initSearchBar } from "./ui/search-bar.js";
import { initSidebar } from "./ui/sidebar.js";
import { initResults } from "./ui/results.js";
import { initSavedList } from "./ui/saved-list.js";

const STORAGE_FAILED = "Couldn't save in this browser. Export a copy to keep your searches.";

const prefs = parsePrefs(loadPrefsText(), SITE_IDS);
let words = ""; // the last words searched (not remembered between visits)
let saved = parseSaved(loadSavedText(), SITE_IDS);
let loadedId = null; // the saved search loaded into the form, if any
let saveStatus = "";

const results = initResults(document.getElementById("results"), { onSave: saveCurrent });
const sidebar = initSidebar({ sites: SITES, prefs, onChange: update });
const searchBar = initSearchBar({
  onSearch(text) {
    // New words are a new search, not an edit of the loaded one.
    if (text.trim() !== words.trim()) loadedId = null;
    words = text;
    saveStatus = "";
    showView("search");
    update(sidebar.read());
  },
});
const savedList = initSavedList(document.getElementById("saved-view"), {
  siteCount: SITE_IDS.length,
  linksFor: (record) => buildLinks(
    buildSearch({ ...record.input, memberships: sidebar.read().memberships }),
    SITE_IDS.filter((id) => !record.input.storesOff.includes(id)),
  ),
  membershipsNow: () => sidebar.read().memberships,
  onLoad: loadSaved,
  onRename(id, label) {
    commitSaved(renameSearch(saved, id, label));
  },
  onDelete(id) {
    if (id === loadedId) loadedId = null;
    commitSaved(deleteSearch(saved, id));
  },
  onExport: exportSaved,
  onImport: importSaved,
  // Returns { ok, message } so the form can show what's wrong.
  onRecordPrice(searchId, form) {
    const result = priceFromForm(form, { id: newId("p"), now: new Date().toISOString(), siteIds: SITE_IDS });
    if (!result.ok) return result;
    const { price } = result;
    const site = SITES.find((s) => s.id === price.siteId)?.name ?? "Other";
    commitSaved(addPrice(saved, searchId, price), `Recorded ${formatMoney(price.amount)} ${price.kind} on ${site}.`);
    return { ok: true };
  },
  onDeletePrice(searchId, priceId) {
    commitSaved(deletePrice(saved, searchId, priceId), "Price deleted.");
  },
});

// Tabs: Search (sidebar + results) and Saved.
const views = {
  search: { tab: document.getElementById("tab-search"), panel: document.querySelector(".layout") },
  saved: { tab: document.getElementById("tab-saved"), panel: document.getElementById("saved-view") },
};
for (const [name, view] of Object.entries(views)) {
  view.tab.addEventListener("click", () => showView(name));
}

function showView(name) {
  for (const [key, view] of Object.entries(views)) {
    view.tab.setAttribute("aria-pressed", String(key === name));
    view.panel.hidden = key !== name;
  }
  if (name === "saved") savedList.render(saved);
}

showView("search");
update(sidebar.read());
savedList.render(saved);
document.getElementById("saved-count").textContent = String(saved.length);

function update(filters) {
  savePrefsText(serializePrefs({
    version: PREFS_VERSION,
    storesOff: filters.storesOff,
    condition: filters.condition,
    format: filters.format,
    location: filters.location,
    exclude: filters.exclude,
    category: filters.category,
    memberships: filters.memberships,
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
    save: { loaded: saved.some((r) => r.id === loadedId), status: saveStatus },
  });
  saveStatus = ""; // a status shows once, until the next change
}

// Saves the list to the browser and redraws; returns false if storage failed.
function commitSaved(next, message) {
  saved = next;
  const stored = saveSavedText(serializeSaved(saved));
  document.getElementById("saved-count").textContent = String(saved.length);
  savedList.render(saved, stored ? message : STORAGE_FAILED);
  return stored;
}

// "s-…" for a saved search, "p-…" for a price.
function newId(prefix = "s") {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function saveCurrent(mode) {
  const input = { ...sidebar.read(), words };
  const now = new Date().toISOString();
  let stored;
  if (mode === "update" && loadedId) {
    stored = commitSaved(updateSearch(saved, loadedId, input, { now, siteIds: SITE_IDS }), "");
    saveStatus = stored ? "Saved search updated." : STORAGE_FAILED;
  } else {
    const id = newId();
    stored = commitSaved(addSearch(saved, input, { id, now, siteIds: SITE_IDS }), "");
    loadedId = id;
    saveStatus = stored ? "Saved." : STORAGE_FAILED;
  }
  update(sidebar.read());
}

function loadSaved(id) {
  const record = saved.find((r) => r.id === id);
  if (!record) return;
  loadedId = id;
  words = record.input.words;
  searchBar.setWords(words);
  sidebar.apply(record.input);
  saveStatus = `Loaded “${record.label}”.`;
  showView("search");
  update(sidebar.read());
}

function exportSaved() {
  const now = new Date();
  const blob = new Blob([exportText(saved, now.toISOString())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(now);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  savedList.render(saved, `Exported ${saved.length} ${saved.length === 1 ? "search" : "searches"} to ${link.download}.`);
}

async function importSaved(file) {
  if (file.size > MAX_IMPORT_BYTES) {
    savedList.render(saved, IMPORT_MESSAGES.tooLarge);
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    savedList.render(saved, IMPORT_MESSAGES.notExport);
    return;
  }
  const parsed = parseImport(text);
  if (!parsed.ok) {
    savedList.render(saved, parsed.message);
    return;
  }
  const merged = mergeImport(saved, parsed.searches, SITE_IDS);
  if (!merged.ok) {
    savedList.render(saved, merged.message);
    return;
  }
  commitSaved(merged.list, merged.message);
}
