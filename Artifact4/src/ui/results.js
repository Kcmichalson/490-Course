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
  // Where Open next is in the list. Nothing else is tracked or shown about
  // which tabs were opened (Dad, M4: "why does it say when stuff is
  // already opened?").
  let step = 0;

  function openNext() {
    if (step >= links.length) {
      step = 0;
    } else {
      window.open(links[step].url, "_blank", "noopener,noreferrer");
      step += 1;
    }
    draw();
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
    notice = openAllMessage(result.opened.length, result.blocked.length);
    draw();
  }

  let notice = ""; // what Open all reports when tabs were blocked

  // { words, exclude: [...], view: "asking" | "sold", selectedCount,
  //   missing: [names of selected stores with no link for this view] }
  let state = { words: "", exclude: [], view: "asking", selectedCount: 0, missing: [] };

  function render(next) {
    // New links (a new search, filter or view) start Open next over.
    const same = next.links.length === links.length && next.links.every((l, i) => l.url === links[i].url);
    if (!same) step = 0;
    state = next;
    links = next.links;
    notice = "";
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
          "Switch to Current listings, or turn on eBay, Mercari, Poshmark, ShopGoodwill or Mercari Japan."),
        missing,
      );
      return;
    }

    const nextButton = el("button", { type: "button", class: "button" },
      step < links.length ? `Open next: ${links[step].name}` : "Start over");
    nextButton.addEventListener("click", openNext);
    const allButton = el("button", { type: "button", class: "button button-primary" }, `Open all (${links.length})`);
    allButton.addEventListener("click", openEveryLink);

    show(
      el("div", { class: "results-head" },
        el("h2", { class: "results-title" }, `${VIEW_TITLES[state.view]} for “${state.words}”`),
        el("div", { class: "open-next" }, allButton, nextButton),
      ),
      understood,
      notice ? el("p", { class: "open-all-message", role: "alert" }, notice) : null,
      el("ul", { class: "links" }, ...links.map(card)),
      missing,
    );
  }

  function card(link) {
    return el("li", { class: "link-card" },
      el("a", { class: "link-main", href: link.url, target: "_blank", rel: "noopener noreferrer" },
        el("span", { class: `badge badge-${link.view}` }, VIEW_LABELS[link.view]),
        el("span", { class: "link-site" }, link.name)),
      el("p", { class: "link-filters" }, link.summary),
      ...link.notes.map((note) => el("p", { class: "link-note" }, note)),
    );
  }

  return { render };
}
