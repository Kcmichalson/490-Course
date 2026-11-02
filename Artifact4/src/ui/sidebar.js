// Filter sidebar: fills the store list and selects, restores remembered
// choices, and reports every change through onChange(read()).

import { QUICK_RANGES, RADII } from "../core/query.js";
import { CATEGORIES, findCategory, suggestionFor } from "../core/categories.js";

const $ = (id) => document.getElementById(id);

export function initSidebar({ sites, prefs, onChange }) {
  const sidebar = $("sidebar");
  const siteIds = sites.map((s) => s.id);
  const nameOf = (id) => sites.find((s) => s.id === id)?.name ?? id;

  // Stores
  for (const site of sites) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.name = "store";
    box.value = site.id;
    box.checked = !prefs.storesOff.includes(site.id);
    const label = document.createElement("label");
    label.append(box, ` ${site.name}`);
    $("store-list").append(label);
  }
  const storeBoxes = () => [...sidebar.querySelectorAll('input[name="store"]')];

  // Price quick ranges
  for (const range of QUICK_RANGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-small";
    button.textContent = range.label;
    button.dataset.min = range.min ?? "";
    button.dataset.max = range.max ?? "";
    $("quick-ranges").append(button);
  }

  // Selects
  for (const r of RADII) $("loc-radius").append(new Option(`${r} miles`, String(r)));
  for (const c of CATEGORIES) $("category").append(new Option(c.label, c.id));

  // City fields show only once their site's adapter exists.
  for (const field of sidebar.querySelectorAll("[data-needs-site]")) {
    field.hidden = !siteIds.includes(field.dataset.needsSite);
  }

  // Puts remembered choices into the form without firing change events.
  // ("exclude" is the Leave out box in the header.)
  function apply(values) {
    for (const box of storeBoxes()) box.checked = !values.storesOff.includes(box.value);
    $("price-min").value = values.priceMin ?? "";
    $("price-max").value = values.priceMax ?? "";
    sidebar.querySelector(`input[name="condition"][value="${values.condition}"]`).checked = true;
    sidebar.querySelector(`input[name="format"][value="${values.format}"]`).checked = true;
    $("loc-zip").value = values.location.zip;
    $("loc-radius").value = String(values.location.radius);
    $("loc-craigslist").value = values.location.craigslistCity;
    $("loc-facebook").value = values.location.facebookCity;
    $("exclude").value = values.exclude;
    $("category").value = values.category;
    showSuggestion();
  }

  function read() {
    return {
      storesOff: storeBoxes().filter((b) => !b.checked).map((b) => b.value),
      priceMin: $("price-min").value,
      priceMax: $("price-max").value,
      condition: sidebar.querySelector('input[name="condition"]:checked').value,
      format: sidebar.querySelector('input[name="format"]:checked').value,
      location: {
        zip: $("loc-zip").value,
        radius: $("loc-radius").value,
        craigslistCity: $("loc-craigslist").value,
        facebookCity: $("loc-facebook").value,
      },
      exclude: $("exclude").value,
      category: $("category").value,
    };
  }

  function showSuggestion() {
    const id = $("category").value;
    const { stores, exclude } = suggestionFor(id, siteIds);
    const hasSuggestion = findCategory(id).id !== "other";
    const parts = [];
    if (stores.length) parts.push(`Suggested stores: ${stores.map(nameOf).join(", ")}.`);
    if (exclude.length) parts.push(`Suggested leave-out words: ${exclude.join(", ")}.`);
    $("category-suggestion").textContent = parts.join(" ");
    $("category-suggestion").hidden = !hasSuggestion;
    $("category-apply").hidden = !hasSuggestion;
  }

  function changed() {
    showSuggestion();
    onChange(read());
  }

  // "input" fires for text fields, checkboxes, radios and selects.
  sidebar.addEventListener("input", changed);

  sidebar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.stores) {
      for (const box of storeBoxes()) box.checked = button.dataset.stores === "all";
    } else if (button.parentElement.id === "quick-ranges") {
      $("price-min").value = button.dataset.min;
      $("price-max").value = button.dataset.max;
    } else if (button.id === "category-apply") {
      const { stores, exclude } = suggestionFor($("category").value, siteIds);
      if (stores.length) {
        for (const box of storeBoxes()) box.checked = stores.includes(box.value);
      }
      // Leave out is a comma list; an item may be a phrase ("base set").
      const words = $("exclude").value.split(",").map((w) => w.trim()).filter(Boolean);
      for (const word of exclude) if (!words.includes(word)) words.push(word);
      $("exclude").value = words.join(", ");
    } else {
      return;
    }
    changed();
  });

  // Phones: the sidebar is a panel opened by the Filters button.
  const toggle = $("filters-toggle");
  toggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide filters" : "Filters";
  });

  apply(prefs);

  return {
    read,
    setMessage(id, text) {
      $(id).textContent = text;
      $(id).hidden = !text;
    },
  };
}
