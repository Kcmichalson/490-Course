// "Open all": opens every link from one click. Browsers let a page open
// only one tab per click unless pop-ups are allowed for the site, so the
// tabs it couldn't open are reported and "Open next" stays as the fallback.
// Pure logic: the caller passes openTab(url), which returns true when the
// browser opened the tab and false when it blocked it.

export function openAll(links, openTab) {
  const opened = [];
  const blocked = [];
  for (const link of links) {
    (openTab(link.url) ? opened : blocked).push(link.url);
  }
  return { opened, blocked };
}

// Nothing to say when every tab opened.
export function openAllMessage(openedCount, blockedCount) {
  if (blockedCount === 0) return "";
  const total = openedCount + blockedCount;
  return `Your browser blocked ${blockedCount} of ${total} tabs. To allow them in Chrome or Edge: ` +
    "click the blocked pop-up icon at the right end of the address bar, choose " +
    "“Always allow pop-ups and redirects” for this site, then press Open all again. " +
    "Or use Open next to open them one at a time.";
}
