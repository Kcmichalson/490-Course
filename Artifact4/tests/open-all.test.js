import { test } from "node:test";
import assert from "node:assert/strict";
import { openAll, openAllMessage } from "../src/core/open-all.js";
import { buildLinks, SITE_IDS } from "../src/core/sites/index.js";
import { buildSearch } from "../src/core/query.js";

const links = buildLinks(buildSearch({ words: "russell wilson foil card" }), SITE_IDS);

test("every tab opens: all opened, in Open next order, no message", () => {
  const tried = [];
  const result = openAll(links, (url) => { tried.push(url); return true; });
  assert.deepEqual(tried, links.map((l) => l.url));
  assert.deepEqual(result, { opened: links.map((l) => l.url), blocked: [] });
  assert.equal(openAllMessage(result.opened.length, result.blocked.length), "");
});

test("pop-ups blocked: the first opens, the rest are blocked, with a message", () => {
  let first = true;
  const result = openAll(links, () => { const ok = first; first = false; return ok; });
  assert.equal(result.opened.length, 1);
  assert.equal(result.opened[0], links[0].url);
  assert.equal(result.blocked.length, links.length - 1);
  const message = openAllMessage(1, links.length - 1);
  assert.ok(message.startsWith(`Your browser blocked ${links.length - 1} of ${links.length} tabs.`), message);
  assert.match(message, /Chrome or Edge/);
  assert.match(message, /Always allow pop-ups and redirects/);
  assert.match(message, /reload this page first/); // M4: Kc had to reopen after allowing
  assert.match(message, /Open next/);
});

test("everything blocked, and no links at all", () => {
  const result = openAll(links, () => false);
  assert.deepEqual(result, { opened: [], blocked: links.map((l) => l.url) });
  assert.match(openAllMessage(0, links.length), new RegExp(`blocked ${links.length} of ${links.length} tabs`));
  assert.deepEqual(openAll([], () => true), { opened: [], blocked: [] });
});
