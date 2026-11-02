// Category hints (Kc's decision, SPEC section 2). A hint only suggests
// stores and exclude words; it never changes the search words.

export const CATEGORIES = [
  { id: "other", label: "Other", stores: [], exclude: [] },
  {
    id: "cards",
    label: "Cards",
    stores: ["ebay", "mercari", "shopgoodwill"],
    exclude: ["lot", "reprint", "custom"],
  },
  {
    id: "toys",
    label: "Toys and figures",
    stores: ["ebay", "mercari", "etsy", "shopgoodwill"],
    exclude: ["lot", "broken"],
  },
  {
    id: "furniture",
    label: "Furniture",
    stores: ["facebook", "craigslist", "offerup"],
    exclude: ["parts", "broken"],
  },
];

export const DEFAULT_CATEGORY = "other";

export function findCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

// The suggestion limited to stores this build has adapters for.
export function suggestionFor(id, siteIds) {
  const category = findCategory(id);
  return {
    stores: category.stores.filter((s) => siteIds.includes(s)),
    exclude: [...category.exclude],
  };
}
