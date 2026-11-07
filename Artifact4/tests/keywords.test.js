import { test } from "node:test";
import assert from "node:assert/strict";
import { KEYWORDS, KEYWORD_CATEGORIES, MAX_SUGGESTIONS, findSuggestions, replaceTerm } from "../src/core/keywords.js";
import { parseQuery } from "../src/core/query.js";

const texts = (search) => findSuggestions(search).map((s) => s.text);
const labels = (search) => findSuggestions(search).map((s) => s.label);

test("every entry has a meaning, a known category and at least one alternate or misspelling", () => {
  // Kc's revision: about 100–120 entries (was 40–60).
  assert.ok(KEYWORDS.length >= 100 && KEYWORDS.length <= 120, `${KEYWORDS.length} entries`);
  for (const k of KEYWORDS) {
    assert.ok(k.means.trim(), k.term);
    assert.equal(typeof k.check, "boolean", k.term);
    assert.ok(KEYWORD_CATEGORIES.includes(k.category), k.term);
    assert.ok(k.alternates.length + k.misspellings.length >= 1, `${k.term} has no alternate`);
    assert.equal(k.term, k.term.toLowerCase().trim(), k.term);
    for (const alt of [...k.alternates, ...k.misspellings]) assert.notEqual(alt, k.term, k.term);
  }
  assert.equal(new Set(KEYWORDS.map((k) => k.term)).size, KEYWORDS.length, "duplicate terms");
});

// Kc removed "russell wilson" (and its misspelling) from the list, so only
// the rc suggestions remain (was: plus "russel wilson rc").
test("russell wilson rc: the rookie card suggestions", () => {
  assert.deepEqual(labels("russell wilson rc"), [
    "Try: russell wilson rookie card",
    "Try: russell wilson rookie",
  ]);
});

test("misspellings come after alternates", () => {
  assert.deepEqual(labels("mahogany dresser"), [
    "Try: mahogany chest of drawers",
    "Try: mahogany bureau",
    "Also try the misspelling: mahagony dresser",
  ]);
});

test("entries Kc removed stay removed", () => {
  const terms = KEYWORDS.map((k) => k.term);
  assert.equal(terms.includes("lot"), false);
  assert.equal(terms.includes("russell wilson"), false);
  const misspellings = KEYWORDS.flatMap((k) => k.misspellings);
  assert.equal(misspellings.includes("pokeman"), false);
  assert.equal(misspellings.includes("funco pop"), false);
});

test("mcm dresser", () => {
  assert.deepEqual(texts("mcm dresser"), [
    "mid century modern dresser",
    "mcm chest of drawers",
    "mcm bureau",
  ]);
});

test("case and punctuation don't matter", () => {
  assert.deepEqual(texts("Russell Wilson RC!"), [
    "Russell Wilson rookie card!",
    "Russell Wilson rookie!",
  ]);
  assert.ok(texts("Mcm, dresser").includes("mid century modern, dresser"));
});

test("multi-word terms, with spaces or hyphens", () => {
  assert.ok(texts("star wars figure new in box").includes("star wars figure nib"));
  assert.ok(texts("mid-century nightstand").includes("midcentury nightstand"));
  assert.ok(texts("Mid   Century dresser").includes("midcentury dresser"));
});

test("a longer term wins over a shorter one inside it", () => {
  const out = texts("mid century modern lamp");
  assert.ok(out.includes("mcm lamp"));
  assert.equal(out.some((t) => t.startsWith("midcentury modern modern")), false);
  assert.equal(out.includes("mcm modern lamp"), false);
});

test("leave-outs are never matched or changed", () => {
  assert.deepEqual(texts("russell wilson card -rc"), []);
  assert.deepEqual(texts('star wars figure -"new in box"'), []);
  assert.equal(replaceTerm("mcm dresser -mcm", "mcm", "mid century modern"), "mid century modern dresser -mcm");
});

test("a suggestion replaces the term; it never adds a search word", () => {
  for (const search of ["russell wilson rc", "mcm dresser", "vtg plush -lot", "nib lego set"]) {
    const before = parseQuery(search, "");
    for (const s of findSuggestions(search)) {
      const entry = KEYWORDS.find((k) => k.term === s.term);
      // The suggestion is exactly the search with that one term swapped for
      // one of its alternates or misspellings...
      const alt = [...entry.alternates, ...entry.misspellings].find((a) => replaceTerm(search, s.term, a) === s.text);
      assert.ok(alt, s.label);
      // ...so with the term (and its swap) taken out, both are the same.
      assert.equal(replaceTerm(s.text, alt, ""), replaceTerm(search, s.term, ""), s.label);
      assert.deepEqual(parseQuery(s.text, "").exclude, before.exclude, s.label);
    }
  }
  assert.equal(replaceTerm("russell wilson rc card", "rc", "rookie card"), "russell wilson rookie card card");
});

test("no suggestions for unknown terms, part-words or empty text", () => {
  assert.deepEqual(findSuggestions("lamp"), []);
  assert.deepEqual(findSuggestions("spider-man figure"), []); // "sp" inside a word
  assert.deepEqual(findSuggestions("autumn quilt"), []); // "auto" isn't "autumn"
  assert.deepEqual(findSuggestions(""), []);
  assert.deepEqual(findSuggestions(undefined), []);
});

test("at most four suggestions, and no repeats", () => {
  const out = findSuggestions("vtg mcm dresser nib plush");
  assert.equal(out.length, MAX_SUGGESTIONS);
  assert.equal(new Set(out.map((s) => s.text.toLowerCase())).size, out.length);
});
