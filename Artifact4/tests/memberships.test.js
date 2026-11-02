import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMBERSHIPS, MEMBERSHIP_IDS, cleanMemberships, membershipNotes } from "../src/core/memberships.js";
import { SITE_IDS } from "../src/core/sites/index.js";

test("each membership has a unique id, a label, a known site and a note", () => {
  assert.equal(new Set(MEMBERSHIP_IDS).size, MEMBERSHIP_IDS.length);
  for (const m of MEMBERSHIPS) {
    assert.ok(m.label.trim(), m.id);
    assert.ok(SITE_IDS.includes(m.siteId), m.id);
    assert.ok(m.note.trim(), m.id);
  }
});

test("cleanMemberships keeps known ids once, in list order", () => {
  assert.deepEqual(cleanMemberships(["walmartplus", "prime", "prime", "costco"]), ["prime", "walmartplus"]);
  assert.deepEqual(cleanMemberships(null), []);
  assert.deepEqual(cleanMemberships("prime"), []);
});

test("membershipNotes gives notes only for that site's ticked memberships", () => {
  assert.equal(membershipNotes("amazon", ["prime"]).length, 1);
  assert.deepEqual(membershipNotes("amazon", ["walmartplus"]), []);
  assert.deepEqual(membershipNotes("ebay", ["prime", "walmartplus"]), []);
});
