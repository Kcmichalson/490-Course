// Results: "Sold for" and "Asking now" groups of site links, each opening
// in a new tab, plus "Open next" to walk through them one click at a time
// (browsers block one click from opening many tabs).

import { VIEW_LABELS } from "../core/sites/index.js";

const GROUPS = [
  {
    view: "sold",
    title: "Sold for",
    blurb: "What people actually paid.",
    empty: "None of the selected stores show sold prices by link.",
  },
  {
    view: "asking",
    title: "Asking now",
    blurb: "What it's listed for right now.",
    empty: "None of the selected stores show asking prices.",
  },
];

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

  let state = { words: "", selectedCount: 0 };

  function render(next) {
    state = next;
    links = next.links;
    const urls = new Set(links.map((l) => l.url));
    for (const url of [...opened]) if (!urls.has(url)) opened.delete(url);
    draw();
  }

  function draw() {
    container.replaceChildren();
    if (!state.words) {
      container.append(
        el("p", { class: "intro" },
          "Type what you're looking for and press Search. Each store's search opens in a new tab."),
      );
      return;
    }
    if (state.selectedCount === 0) {
      container.append(el("p", { class: "intro" }, "No stores selected. Turn some on under Stores."));
      return;
    }

    const i = nextIndex();
    const status = i === -1
      ? `All ${links.length} opened.`
      : `Next: ${links[i].name} (${VIEW_LABELS[links[i].view]}), ${i + 1} of ${links.length}`;
    const nextButton = el("button", { type: "button", class: "button button-primary" },
      i === -1 ? "Start over" : "Open next");
    nextButton.addEventListener("click", openNext);

    container.append(
      el("div", { class: "results-head" },
        el("h2", { class: "results-title" }, `Results for “${state.words}”`),
        el("div", { class: "open-next" }, nextButton, el("span", { class: "open-next-status" }, status)),
      ),
    );

    for (const group of GROUPS) {
      const items = links
        .map((link, index) => ({ link, index }))
        .filter(({ link }) => link.view === group.view);
      const section = el("section", { class: "group", "aria-label": group.title },
        el("h3", { class: "group-title" }, group.title, el("span", { class: "group-blurb" }, group.blurb)));
      if (items.length === 0) {
        section.append(el("p", { class: "group-empty" }, group.empty));
      } else {
        section.append(el("ul", { class: "links" }, ...items.map(({ link, index }) => card(link, index === i))));
      }
      container.append(section);
    }
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
      link.note ? el("p", { class: "link-note" }, link.note) : null,
    );
  }

  return { render };
}
