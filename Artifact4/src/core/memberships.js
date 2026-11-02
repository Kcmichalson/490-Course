// "My memberships" (SPEC section 4). The app can't see prices, so a
// membership adds a note to its site's links. A member filter in the link
// would go in that site's adapter; none is confirmed yet (Amazon's Prime
// filter was dropped after check 34). The wording is Claude's draft (M2
// plan).

export const MEMBERSHIPS = [
  {
    id: "prime",
    label: "Amazon Prime",
    siteId: "amazon",
    note: "Prime: free shipping on eligible items, so compare totals.",
  },
  {
    id: "walmartplus",
    label: "Walmart+",
    siteId: "walmart",
    note: "Walmart+: free shipping on eligible items, so compare totals.",
  },
];

export const MEMBERSHIP_IDS = MEMBERSHIPS.map((m) => m.id);

// Known ids only, no duplicates, in list order.
export function cleanMemberships(value) {
  if (!Array.isArray(value)) return [];
  return MEMBERSHIP_IDS.filter((id) => value.includes(id));
}

// The notes for one site's links, given the memberships he ticked.
export function membershipNotes(siteId, ids) {
  return MEMBERSHIPS.filter((m) => m.siteId === siteId && ids.includes(m.id)).map((m) => m.note);
}
