// Results: one store link per selected store for the chosen view (current
// or sold listings), each opening in a new tab, plus "Open all" and "Open
// next" (the fallback when the browser blocks pop-ups).

import { VIEW_LABELS } from "../core/sites/index.js";
import { openAll, openAllMessage } from "../core/open-all.js";

const VIEW_TITLES = { asking: "Current listings", sold: "Sold listings" };

// Small DOM helper; text is always set as text, never as HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c !== null && c !== ""));
  return node;
}

export function initResults(container) {
  let links = [];
  const opened = new Set(); // URLs opened since the links last changed

  function nextIndex() {
    return links.findIndex((link) => !opened.has(link.url));
  }

  function markOpened(url) {
    opened.add(url);
    draw();
  }

  function openNext() {
    const i = nextIndex();
    if (i === -1) {
      opened.clear();
      draw();
      return;
    }
    window.open(links[i].url, "_blank", "noopener,noreferrer");
    markOpened(links[i].url);
  }

  // window.open with "noopener" always returns null, so it can't tell a
  // blocked tab from an opened one. Open without it, then cut the link
  // back to this page by hand: same protection, and null means blocked.
  function openTab(url) {
    const tab = window.open(url, "_blank");
    if (!tab) return false;
    try {
      tab.opener = null;
    } catch {
      // Some browsers don't allow setting it; the tab is still open.
    }
    return true;
  }

  function openEveryLink() {
    const result = openAll(links, openTab);
    for (const url of result.opened) opened.add(url);
    notice = openAllMessage(result.opened.length, result.blocked.length);
    draw();
  }

  let notice = ""; // what Open all reports when tabs were blocked

  // { words, exclude: [...], view: "asking" | "sold", selectedCount,
  //   missing: [names of selected stores with no link for this view] }
  let state = { words: "", exclude: [], view: "asking", selectedCount: 0, missing: [] };

  function render(next) {
    state = next;
    links = next.links;
    notice = "";
    const urls = new Set(links.map((l) => l.url));
    for (const url of [...opened]) if (!urls.has(url)) opened.delete(url);
    draw();
  }

  function draw() {
    container.replaceChildren();
    if (!state.words) {
      container.append(
        el("p", { class: "intro" },
          "Type what you're looking for and press Search. Put words to leave out after a minus " +
          "(-reprint) or in the Leave out box. Open all opens every store's search in its own tab."),
      );
      return;
    }
    if (state.selectedCount === 0) {
      container.append(el("p", { class: "intro" }, "No stores selected. Turn some on under Stores."));
      return;
    }

    // What the two boxes were understood as.
    const understood = el("p", { class: "results-understood" },
      "Searching for ", el("strong", {}, state.words),
      state.exclude.length ? " · Leaving out: " : "",
      state.exclude.length ? el("strong", {}, state.exclude.join(", ")) : null);
    const missing = state.missing.length
      ? el("p", { class: "results-missing" }, `No sold view: ${state.missing.join(", ")}.`)
      : null;

    // append() would print a null as the text "null", so leave those out.
    const show = (...nodes) => container.append(...nodes.filter(Boolean));

    if (links.length === 0) {
      show(
        el("h2", { class: "results-title" }, `${VIEW_TITLES[state.view]} for “${state.words}”`),
        understood,
        el("p", { class: "intro" }, "None of the selected stores show sold listings by link. " +
          "Switch to Current listings, or turn on eBay, Mercari, Poshmark or ShopGoodwill."),
        missing,
      );
      return;
    }

    const i = nextIndex();
    const status = i === -1
      ? `All ${links.length} opened.`
      : `Next: ${links[i].name}, ${i + 1} of ${links.length}`;
    const nextButton = el("button", { type: "button", class: "button" },
      i === -1 ? "Start over" : "Open next");
    nextButton.addEventListener("click", openNext);
    const allButton = el("button", { type: "button", class: "button button-primary" }, `Open all (${links.length})`);
    allButton.addEventListener("click", openEveryLink);

    show(
      el("div", { class: "results-head" },
        el("h2", { class: "results-title" }, `${VIEW_TITLES[state.view]} for “${state.words}”`),
        el("div", { class: "open-next" },
          allButton, nextButton, el("span", { class: "open-next-status" }, status)),
      ),
      understood,
      notice ? el("p", { class: "open-all-message", role: "alert" }, notice) : null,
      el("ul", { class: "links" }, ...links.map((link, index) => card(link, index === i))),
      missing,
    );
  }

  function card(link, isNext) {
    const isOpened = opened.has(link.url);
    const anchor = el("a", {
      class: "link-main",
      href: link.url,
      target: "_blank",
      rel: "noopener noreferrer",
    },
      el("span", { class: `badge badge-${link.view}` }, VIEW_LABELS[link.view]),
      el("span", { class: "link-site" }, link.name),
      isOpened ? el("span", { class: "link-opened" }, "Opened") : null,
    );
    anchor.addEventListener("click", () => setTimeout(() => markOpened(link.url)));
    const classes = ["link-card"];
    if (isOpened) classes.push("is-opened");
    if (isNext) classes.push("is-next");
    return el("li", { class: classes.join(" ") },
      anchor,
      el("p", { class: "link-filters" }, link.summary),
      ...link.notes.map((note) => el("p", { class: "link-note" }, note)),
    );
  }

  return { render };
}
