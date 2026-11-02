// Saved searches view: a filter bar, Export and Import, and one card per
// saved search with its site links (one click to re-check), Load, Rename
// and Delete. main.js owns the list and its storage; this file only draws
// it and reports what he clicked.

import { CATEGORIES } from "../core/categories.js";
import { VIEW_LABELS } from "../core/sites/index.js";
import { filterSearches, summarizeInput } from "../core/saved.js";
import { el } from "./results.js";

export function initSavedList(container, { siteCount, linksFor, onLoad, onRename, onDelete, onExport, onImport }) {
  let list = [];
  let renamingId = null;

  // The toolbar is built once, so typing in the filter box keeps its focus.
  const filterText = el("input", {
    type: "search", id: "saved-filter", placeholder: "Filter saved searches", autocomplete: "off",
  });
  const filterCategory = el("select", { id: "saved-category" },
    el("option", { value: "all" }, "All categories"),
    ...CATEGORIES.map((c) => el("option", { value: c.id }, c.label)));
  const exportButton = el("button", { type: "button", class: "button button-small" }, "Export");
  const importButton = el("button", { type: "button", class: "button button-small" }, "Import");
  const fileInput = el("input", { type: "file", accept: ".json,application/json", hidden: "" });
  const message = el("p", { class: "saved-message", role: "status", hidden: "" });
  const items = el("div", { class: "saved-items" });

  filterText.addEventListener("input", draw);
  filterCategory.addEventListener("input", draw);
  exportButton.addEventListener("click", onExport);
  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;
    fileInput.value = ""; // so picking the same file again still fires
    if (file) onImport(file);
  });

  container.append(
    el("div", { class: "saved-head" },
      el("h2", { class: "results-title" }, "Saved searches"),
      el("div", { class: "button-row" }, exportButton, importButton, fileInput),
    ),
    el("div", { class: "saved-filters" },
      el("label", { for: "saved-filter", class: "visually-hidden" }, "Filter saved searches"), filterText,
      el("label", { for: "saved-category", class: "visually-hidden" }, "Category"), filterCategory,
    ),
    message,
    items,
  );

  function render(nextList, text) {
    list = nextList;
    if (text !== undefined) {
      message.textContent = text;
      message.hidden = !text;
    }
    draw();
  }

  function draw() {
    items.replaceChildren();
    if (list.length === 0) {
      items.append(el("p", { class: "intro" }, "No saved searches yet. Search, then press Save this search."));
      return;
    }
    const shown = filterSearches(list, { text: filterText.value, category: filterCategory.value });
    if (shown.length === 0) {
      items.append(el("p", { class: "intro" }, "No saved searches match."));
      return;
    }
    items.append(el("ul", { class: "saved-cards" }, ...shown.map(card)));
  }

  function card(record) {
    const links = linksFor(record);
    const chips = links.length
      ? el("ul", { class: "chips", "aria-label": "Store links" }, ...links.map((link) =>
        el("li", {},
          el("a", { class: "chip", href: link.url, target: "_blank", rel: "noopener noreferrer" },
            el("span", { class: `badge badge-${link.view}` }, VIEW_LABELS[link.view]), link.name))))
      : el("p", { class: "field-note" }, "No stores selected for this search.");

    return el("li", { class: "saved-card" },
      renamingId === record.id ? renameForm(record) : el("h3", { class: "saved-label" }, record.label),
      record.label !== record.input.words ? el("p", { class: "saved-words" }, record.input.words) : null,
      el("p", { class: "link-filters" }, summarizeInput(record.input, siteCount)),
      chips,
      el("div", { class: "button-row" },
        action("Load", "button button-small button-primary", () => onLoad(record.id)),
        action("Rename", "button button-small", () => { renamingId = record.id; draw(); focusRename(); }),
        action("Delete", "button button-small", () => {
          if (window.confirm(`Delete “${record.label}”?`)) onDelete(record.id);
        }),
      ),
    );
  }

  function renameForm(record) {
    const input = el("input", { type: "text", class: "rename-input", "aria-label": "New name", maxlength: "200" });
    input.value = record.label;
    const form = el("form", { class: "rename-form" },
      input,
      el("button", { type: "submit", class: "button button-small button-primary" }, "Save name"),
      action("Cancel", "button button-small", () => { renamingId = null; draw(); }),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renamingId = null;
      onRename(record.id, input.value);
    });
    return form;
  }

  function focusRename() {
    const input = items.querySelector(".rename-input");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function action(text, className, handler) {
    const button = el("button", { type: "button", class: className }, text);
    button.addEventListener("click", handler);
    return button;
  }

  return { render };
}
