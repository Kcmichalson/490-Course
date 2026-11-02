// Saved searches view: a filter and sort bar, Export and Import, and one
// card per saved search with its latest prices, its site links (one click
// to re-check), Load, Record a price, Rename, Delete and its price history.
// main.js owns the list and its storage; this file only draws it and
// reports what he clicked.

import { CATEGORIES } from "../core/categories.js";
import { SITES, VIEW_LABELS } from "../core/sites/index.js";
import { filterSearches, summarizeInput } from "../core/saved.js";
import {
  OTHER_SITE, SORT_MODES, describePrice, formatDay, formatMoney, lastChecked, latestPrice,
  localDay, membershipFor, pricesNewestFirst, sortSearches, totalCents,
} from "../core/prices.js";
import { MEMBERSHIPS } from "../core/memberships.js";
import { el } from "./results.js";

const siteName = (id) => (SITES.find((s) => s.id === id) ?? OTHER_SITE).name;

export function initSavedList(container, {
  siteCount, linksFor, membershipsNow, onLoad, onRename, onDelete, onExport, onImport, onRecordPrice, onDeletePrice,
}) {
  let list = [];
  let renamingId = null;
  let recordingId = null; // the card showing the "Record a price" form
  const openHistory = new Set(); // cards whose "Prices (N)" list is open

  // The toolbar is built once, so typing in the filter box keeps its focus.
  const filterText = el("input", {
    type: "search", id: "saved-filter", placeholder: "Filter saved searches", autocomplete: "off",
  });
  const filterCategory = el("select", { id: "saved-category" },
    el("option", { value: "all" }, "All categories"),
    ...CATEGORIES.map((c) => el("option", { value: c.id }, c.label)));
  const sortSelect = el("select", { id: "saved-sort" },
    ...SORT_MODES.map((m) => el("option", { value: m.id }, m.label)));
  const exportButton = el("button", { type: "button", class: "button button-small" }, "Export");
  const importButton = el("button", { type: "button", class: "button button-small" }, "Import");
  const fileInput = el("input", { type: "file", accept: ".json,application/json", hidden: "" });
  const message = el("p", { class: "saved-message", role: "status", hidden: "" });
  const items = el("div", { class: "saved-items" });

  filterText.addEventListener("input", draw);
  filterCategory.addEventListener("input", draw);
  sortSelect.addEventListener("input", draw);
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
      el("label", { for: "saved-sort", class: "visually-hidden" }, "Sort"), sortSelect,
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
    const shown = sortSearches(
      filterSearches(list, { text: filterText.value, category: filterCategory.value }),
      sortSelect.value,
    );
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

    const checked = lastChecked(record);
    return el("li", { class: "saved-card" },
      renamingId === record.id ? renameForm(record) : el("h3", { class: "saved-label" }, record.label),
      record.label !== record.input.words ? el("p", { class: "saved-words" }, record.input.words) : null,
      el("p", { class: "link-filters" }, summarizeInput(record.input, siteCount)),
      el("div", { class: "price-lines" },
        priceLine(record, "sold"),
        priceLine(record, "asking"),
        el("p", { class: "price-checked" }, checked ? `Last checked ${formatDay(checked, new Date())}` : "Not checked yet"),
      ),
      chips,
      el("div", { class: "button-row" },
        action("Load", "button button-small button-primary", () => onLoad(record.id)),
        action("Record a price", "button button-small", () => { recordingId = record.id; draw(); focusPriceForm(); }),
        action("Rename", "button button-small", () => { renamingId = record.id; draw(); focusRename(); }),
        action("Delete", "button button-small", () => {
          if (window.confirm(`Delete “${record.label}”?`)) onDelete(record.id);
        }),
      ),
      recordingId === record.id ? priceForm(record) : null,
      record.prices.length ? priceHistory(record) : null,
    );
  }

  // "Sold  $16.50 your total ($12.50 + $4.00 shipping) · eBay · Nov 1"
  function priceLine(record, kind) {
    const badge = el("span", { class: `badge badge-${kind}` }, VIEW_LABELS[kind]);
    const p = latestPrice(record, kind);
    if (!p) return el("p", { class: "price-line price-none" }, badge, ` No ${kind} price yet`);
    return el("p", { class: "price-line" },
      badge, " ", el("strong", {}, formatMoney(totalCents(p))),
      ` your total (${describePrice(p)}) · ${siteName(p.siteId)} · ${formatDay(p.date, new Date())}`);
  }

  function priceForm(record) {
    const kindName = `kind-${record.id}`;
    const kind = (value, text, checked) => {
      const input = el("input", { type: "radio", name: kindName, value });
      input.checked = checked;
      return el("label", {}, input, ` ${text}`);
    };
    const site = el("select", { name: "siteId" },
      ...SITES.map((s) => el("option", { value: s.id }, s.name)),
      el("option", { value: OTHER_SITE.id }, OTHER_SITE.name));
    site.value = SITES.find((s) => !record.input.storesOff.includes(s.id))?.id ?? SITES[0].id;
    const amount = el("input", { type: "text", name: "amount", inputmode: "decimal", autocomplete: "off" });
    const shipping = el("input", { type: "text", name: "shipping", inputmode: "decimal", autocomplete: "off" });
    const memberBox = el("input", { type: "checkbox", name: "memberFree" });
    const memberText = el("span", {});
    const memberLabel = el("label", { class: "member-free" }, memberBox, memberText);
    const date = el("input", { type: "date", name: "date", value: localDay(new Date()) });
    const note = el("input", { type: "text", name: "note", maxlength: "200", autocomplete: "off" });
    const message = el("p", { class: "field-note field-warning", role: "alert", hidden: "" });

    // "Free shipping with Amazon Prime" shows only for a membership he has
    // ticked, on that membership's store.
    function showMember() {
      const member = membershipFor(site.value);
      const has = member && membershipsNow().includes(member.id);
      memberLabel.hidden = !has;
      if (!has) memberBox.checked = false;
      memberText.textContent = has ? ` Free shipping with ${MEMBERSHIPS.find((m) => m.id === member.id).label}` : "";
    }
    site.addEventListener("input", showMember);
    showMember();

    const form = el("form", { class: "price-form", "aria-label": `Record a price for ${record.label}` },
      el("fieldset", { class: "price-kind" },
        el("legend", { class: "visually-hidden" }, "Sold or asking"),
        kind("sold", "Sold", true), kind("asking", "Asking", false)),
      el("label", {}, "Store", site),
      el("div", { class: "price-row" },
        el("label", {}, "Price $", amount),
        el("label", {}, "Shipping $", shipping)),
      memberLabel,
      el("p", { class: "field-note" }, "Leave shipping blank if you don't know it; 0 means free."),
      el("label", {}, "Date", date),
      el("label", {}, "Note (optional)", note),
      message,
      el("div", { class: "button-row" },
        el("button", { type: "submit", class: "button button-small button-primary" }, "Save price"),
        action("Cancel", "button button-small", () => { recordingId = null; draw(); })),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      recordingId = null; // a successful save redraws the list without the form
      const result = onRecordPrice(record.id, {
        kind: form.querySelector(`input[name="${kindName}"]:checked`)?.value ?? "",
        siteId: site.value,
        amount: amount.value,
        shipping: shipping.value,
        memberFree: memberBox.checked,
        date: date.value,
        note: note.value,
      });
      if (!result.ok) {
        recordingId = record.id;
        message.textContent = result.message;
        message.hidden = false;
      }
    });
    return form;
  }

  function priceHistory(record) {
    const details = el("details", { class: "price-history" },
      el("summary", {}, `Prices (${record.prices.length})`),
      el("ul", {}, ...pricesNewestFirst(record).map((p) => {
        const day = formatDay(p.date, new Date());
        return el("li", {},
          el("span", {},
            el("span", { class: `badge badge-${p.kind}` }, VIEW_LABELS[p.kind]),
            ` ${day} · ${siteName(p.siteId)} · `,
            el("strong", {}, formatMoney(totalCents(p))),
            ` (${describePrice(p)})`,
            p.note ? ` · ${p.note}` : ""),
          action("Delete", "button button-small", () => {
            if (window.confirm(`Delete the ${formatMoney(p.amount)} ${siteName(p.siteId)} price from ${day}?`)) {
              onDeletePrice(record.id, p.id);
            }
          }));
      })));
    details.open = openHistory.has(record.id);
    details.addEventListener("toggle", () => {
      if (details.open) openHistory.add(record.id);
      else openHistory.delete(record.id);
    });
    return details;
  }

  function focusPriceForm() {
    items.querySelector('.price-form input[name="amount"]')?.focus();
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
