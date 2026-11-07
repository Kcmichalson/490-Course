// Filter sidebar: fills the store list and selects, restores remembered
// choices, and reports every change through onChange(read()).

import { QUICK_RANGES, RADII } from "../core/query.js";

const $ = (id) => document.getElementById(id);

export function initSidebar({ sites, prefs, onChange }) {
  const sidebar = $("sidebar");
  const siteIds = sites.map((s) => s.id);

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

  // City fields show only once their site's adapter exists.
  for (const field of sidebar.querySelectorAll("[data-needs-site]")) {
    field.hidden = !siteIds.includes(field.dataset.needsSite);
  }

  // Puts values into the form without firing change events: remembered
  // choices at start, or a shared link's fields (M5). Only the fields given
  // are set; the rest keep what's there. ("exclude" is the Leave out box in
  // the header.)
  function apply(values) {
    const has = (key) => values[key] !== undefined;
    if (has("storesOff")) {
      for (const box of storeBoxes()) box.checked = !values.storesOff.includes(box.value);
    }
    if (has("priceMin")) $("price-min").value = values.priceMin;
    if (has("priceMax")) $("price-max").value = values.priceMax;
    if (has("condition")) sidebar.querySelector(`input[name="condition"][value="${values.condition}"]`).checked = true;
    if (has("format")) sidebar.querySelector(`input[name="format"][value="${values.format}"]`).checked = true;
    const loc = values.location ?? {};
    if (loc.zip !== undefined) $("loc-zip").value = loc.zip;
    if (loc.radius !== undefined) $("loc-radius").value = String(loc.radius);
    if (loc.craigslistCity !== undefined) $("loc-craigslist").value = loc.craigslistCity;
    if (loc.facebookCity !== undefined) $("loc-facebook").value = loc.facebookCity;
    if (has("exclude")) $("exclude").value = values.exclude;
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
    };
  }

  function changed() {
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
    apply,
    setMessage(id, text) {
      $(id).textContent = text;
      $(id).hidden = !text;
    },
  };
}
