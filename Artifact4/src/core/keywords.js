// Keyword helper (M5): a small built-in word list of listing abbreviations,
// jargon, synonyms and common misspellings. No network, no AI. When the
// search uses a known term, the app suggests alternate searches with that
// term swapped (search words are AND, so a suggestion replaces the term and
// never adds words). Pure logic: no DOM.
//
// Each entry: { term, means, category, alternates, misspellings, check }
// - alternates: other ways listings write the SAME thing (abbreviation <->
//   full form, true synonyms, spelling variants). Never a term with a
//   different meaning (gold filled for gold, replica for original, for
//   parts for working) - Kc's rule
// - misspellings: only ones common in real listings
// - check: Claude wasn't sure; Kc to confirm
// Every entry has at least one alternate or misspelling. Revised list for
// Kc's review (Session 2).

export const KEYWORD_CATEGORIES = [
  "cards", "toys", "games", "electronics", "clothing", "records",
  "coins", "jewelry", "tools", "collectibles", "furniture", "general",
];

const k = (term, means, category, alternates, misspellings = [], check = false) =>
  ({ term, means, category, alternates, misspellings, check });

export const KEYWORDS = [
  // Cards
  k("rc", "rookie card", "cards", ["rookie card", "rookie"]),
  k("rookie card", "a player's first card", "cards", ["rc"]),
  k("auto", "autographed card", "cards", ["autograph", "signed"], [], true), // "auto" also means cars
  k("autograph", "signed by the player or artist", "cards", ["auto", "signed"]),
  k("signed", "autographed", "cards", ["autographed", "auto"]),
  k("holo", "holographic (shiny) card", "cards", ["holographic", "holofoil"]),
  k("1st edition", "first print run (e.g. Pokémon)", "cards", ["first edition", "1st ed"]),
  k("first edition", "first print run", "cards", ["1st edition"]),
  k("sp", "short print (printed in smaller numbers)", "cards", ["short print"], [], true), // "SP" has other meanings
  k("ssp", "super short print", "cards", ["super short print"]),
  k("relic", "card with a piece of game-used memorabilia", "cards", ["memorabilia card"]),
  k("pokemon", "Pokémon trading cards and toys", "cards", ["pokémon"]),

  // Toys and figures
  k("nib", "new in box", "toys", ["new in box"]),
  k("new in box", "unused, in its original box", "toys", ["nib"]),
  k("nrfb", "never removed from box", "toys", ["never removed from box"]),
  k("moc", "mint on card (sealed on its backing card)", "toys", ["mint on card"]),
  k("mib", "mint in box", "toys", ["mint in box"]),
  k("misb", "mint in sealed box", "toys", ["mint in sealed box"]),
  k("sealed", "still in its factory packaging", "toys", ["factory sealed"]),
  k("funko pop", "Funko Pop! vinyl figure", "toys", ["pop vinyl"]),
  k("plush", "stuffed toy", "toys", ["plushie", "stuffed animal"]),
  k("stuffed animal", "plush toy", "toys", ["plush", "plushie"]),
  k("lego", "LEGO building sets", "toys", ["legos"]),
  k("hot wheels", "Hot Wheels die-cast cars", "toys", ["hotwheels"]),
  k("beanie baby", "Ty Beanie Babies plush", "toys", ["beanie babies"]),

  // Video games
  k("cib", "complete in box (game, case and manual)", "games", ["complete in box"]),
  k("complete in box", "game with its case and manual", "games", ["cib"]),
  k("nes", "Nintendo Entertainment System", "games", ["nintendo entertainment system"]),
  k("snes", "Super Nintendo", "games", ["super nintendo"]),
  k("n64", "Nintendo 64", "games", ["nintendo 64"]),
  k("gba", "Game Boy Advance", "games", ["game boy advance"]),
  k("game boy", "Nintendo Game Boy", "games", ["gameboy"]),
  k("ps1", "PlayStation 1", "games", ["playstation 1", "psx"]),
  k("ps2", "PlayStation 2", "games", ["playstation 2"]),
  k("gamecube", "Nintendo GameCube", "games", ["game cube"]),

  // Electronics
  k("refurbished", "repaired and tested to work like new", "electronics", ["refurb"]),
  k("tv", "television", "electronics", ["television"]),
  k("gpu", "graphics card", "electronics", ["graphics card", "video card"]),
  k("cpu", "processor", "electronics", ["processor"]),
  k("ssd", "solid state drive", "electronics", ["solid state drive"]),
  k("hdd", "hard disk drive", "electronics", ["hard drive", "hard disk drive"]),
  k("dslr", "digital single-lens reflex camera", "electronics", ["digital slr"]),

  // Clothing and shoes
  k("vnds", "very near deadstock (worn once or twice)", "clothing", ["very near deadstock"]),
  k("deadstock", "never worn, often with the original box", "clothing", ["dead stock"]),
  k("hoodie", "hooded sweatshirt", "clothing", ["hooded sweatshirt"]),
  k("t-shirt", "T-shirt", "clothing", ["tshirt", "tee"], [], true), // "tee" also means golf tee
  k("sz", "size", "clothing", ["size"]),
  k("aj", "Air Jordan (sneakers)", "clothing", ["air jordan"], [], true), // "AJ" can be initials
  k("sneakers", "athletic shoes", "clothing", ["tennis shoes"], [], true),

  // Vinyl records
  k("lp", "long-play record (33⅓ rpm album)", "records", ["33 rpm"], [], true),
  k("45 rpm", "7-inch single", "records", ["7 inch single"], [], true),
  k("first pressing", "first manufacturing run of a record", "records", ["1st pressing"]),
  k("1st pressing", "first pressing", "records", ["first pressing"]),
  k("nm", "near mint (grade)", "records", ["near mint"]),
  k("vg+", "very good plus (grade)", "records", ["very good plus"]),
  k("ost", "original soundtrack", "records", ["original soundtrack", "soundtrack"]),
  k("turntable", "record player", "records", ["record player"]),
  k("record player", "turntable", "records", ["turntable"]),

  // Coins
  k("bu", "brilliant uncirculated (grade)", "coins", ["brilliant uncirculated"], [], true), // "BU" also a university
  k("uncirculated", "never used as money", "coins", ["unc"], [], true), // "UNC" also a university
  k("morgan dollar", "Morgan silver dollar (1878–1921)", "coins", ["morgan silver dollar"]),
  k("peace dollar", "Peace silver dollar (1921–1935)", "coins", ["peace silver dollar"]),
  k("silver eagle", "American Silver Eagle bullion coin", "coins", ["american silver eagle", "ase"]),
  k("ase", "American Silver Eagle", "coins", ["american silver eagle"], [], true),
  k("wheat penny", "Lincoln wheat cent (1909–1958)", "coins", ["wheat cent"]),
  k("buffalo nickel", "Indian Head (Buffalo) nickel", "coins", ["indian head nickel"]),
  k("mercury dime", "Winged Liberty Head dime", "coins", ["winged liberty dime"]),
  k("error coin", "coin with a minting mistake", "coins", ["mint error"]),

  // Jewelry
  k("925", "sterling silver hallmark", "jewelry", ["sterling silver", "sterling"]),
  k("sterling", "sterling silver (92.5% silver)", "jewelry", ["925", "sterling silver"]),
  k("14k", "14 karat gold", "jewelry", ["14kt", "14 karat", "585"]),
  k("18k", "18 karat gold", "jewelry", ["18kt", "18 karat", "750"]),
  k("10k", "10 karat gold", "jewelry", ["10kt", "10 karat", "417"], [], true), // "10k" also a race
  k("ctw", "carat total weight", "jewelry", ["tcw", "carat total weight"]),
  k("tcw", "total carat weight", "jewelry", ["ctw", "total carat weight"]),
  k("cz", "cubic zirconia", "jewelry", ["cubic zirconia"], [], true), // "CZ" also a gun maker
  k("jewelry", "jewelry (US spelling)", "jewelry", ["jewellery"], ["jewlery"], true),

  // Tools
  k("sawzall", "reciprocating saw (Milwaukee's name for it)", "tools", ["reciprocating saw"], [], true),
  k("socket set", "set of sockets for a ratchet", "tools", ["socket wrench set"]),
  k("multimeter", "electrical meter", "tools", ["multi meter"]),
  k("tool only", "power tool sold without battery or charger", "tools", ["bare tool"]),
  k("bare tool", "power tool sold without battery or charger", "tools", ["tool only"]),
  k("shop vac", "wet/dry vacuum", "tools", ["wet dry vac"], [], true),

  // General collectibles
  k("coa", "certificate of authenticity", "collectibles", ["certificate of authenticity"]),
  k("certificate of authenticity", "proof an item is genuine", "collectibles", ["coa"]),
  k("limited edition", "made in a limited number", "collectibles", ["ltd edition", "ltd ed"]),
  k("ooak", "one of a kind", "collectibles", ["one of a kind"]),
  k("one of a kind", "unique, only one made", "collectibles", ["ooak"]),
  k("ussr", "Soviet Union", "collectibles", ["soviet", "cccp"]),
  k("wwii", "World War II", "collectibles", ["ww2", "world war ii", "world war 2"]),
  k("ww2", "World War II", "collectibles", ["wwii", "world war ii"]),
  k("handmade", "made by hand", "collectibles", ["hand made"]),

  // Furniture
  k("mcm", "mid-century modern (about 1945–1970 design)", "furniture", ["mid century modern"]),
  k("mid century modern", "mid-century modern style", "furniture", ["mcm", "midcentury modern"]),
  k("mid century", "mid-century (modern) style", "furniture", ["midcentury", "mcm"]),
  k("dresser", "chest of drawers", "furniture", ["chest of drawers", "bureau"], [], true),
  k("nightstand", "small bedside table", "furniture", ["night stand", "bedside table"]),
  k("credenza", "low cabinet with doors", "furniture", ["sideboard", "buffet"], [], true),
  k("sideboard", "low dining-room cabinet", "furniture", ["credenza", "buffet"], [], true),
  k("armoire", "tall wardrobe cabinet", "furniture", ["wardrobe"]),
  k("loveseat", "two-seat sofa", "furniture", ["love seat"]),
  k("couch", "sofa", "furniture", ["sofa"]),
  k("sofa", "couch", "furniture", ["couch"]),
  k("coffee table", "low living-room table", "furniture", ["cocktail table"]),
  k("chaise longue", "long reclining chair", "furniture", [], ["chaise lounge"]),
  k("mahogany", "a reddish-brown hardwood", "furniture", [], ["mahagony"], true),

  // General
  k("vtg", "vintage", "general", ["vintage"]),
  k("vintage", "older, usually 20+ years", "general", ["vtg"]),
  k("euc", "excellent used condition", "general", ["excellent used condition"]),
  k("guc", "good used condition", "general", ["good used condition"]),
  k("htf", "hard to find", "general", ["hard to find"]),
  k("oop", "out of print", "general", ["out of print"]),
  k("nwt", "new with tags", "general", ["new with tags"]),
  k("nwot", "new without tags", "general", ["new without tags"]),
  k("nwob", "new without box", "general", ["new without box"]),
  k("nos", "new old stock (old, never sold or used)", "general", ["new old stock"], [], true), // "NOS" also nitrous
  k("new old stock", "old, never sold or used", "general", ["nos"]),
  k("porcelain", "fine ceramic", "general", [], ["porcelin"], true),
];

export const MAX_SUGGESTIONS = 4;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A term inside the search: not part of a longer word, not a -leave-out
// (or -"leave out"), any case; spaces or hyphens between its words.
function termPattern(term) {
  const body = term.split(" ").map(escape).join("[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}-])(?<!-")${body}(?![\\p{L}\\p{N}])`, "iu");
}

const PATTERNS = new Map(KEYWORDS.map((k) => [k.term, termPattern(k.term)]));
const tidy = (text) => text.replace(/\s+/g, " ").trim();

// The search text with the first match of `term` replaced by `replacement`.
export function replaceTerm(searchText, term, replacement) {
  return tidy(String(searchText).replace(PATTERNS.get(term) ?? termPattern(term), () => replacement));
}

// Suggestions for the Search for text: [{ label, text, term }], at most
// MAX_SUGGESTIONS, alternates before misspellings, in the order the terms
// appear. A suggestion that would give the same search is skipped.
export function findSuggestions(searchText) {
  const text = String(searchText ?? "").replace(/[“”„‟″]/g, '"');
  const matches = [];
  for (const entry of KEYWORDS) {
    const match = PATTERNS.get(entry.term).exec(text);
    if (match) matches.push({ entry, at: match.index, end: match.index + match[0].length });
  }
  // A longer term wins over a shorter one inside it ("mid century modern"
  // over "mid century").
  const found = matches
    .filter((m) => !matches.some((o) => o !== m && o.at <= m.at && o.end >= m.end && o.end - o.at > m.end - m.at))
    .sort((a, b) => a.at - b.at);

  const seen = new Set([tidy(text).toLowerCase()]);
  const make = (kind) => found.flatMap(({ entry }) =>
    entry[kind].map((alt) => {
      const next = replaceTerm(text, entry.term, alt);
      const label = kind === "misspellings" ? `Also try the misspelling: ${next}` : `Try: ${next}`;
      return { label, text: next, term: entry.term };
    }));
  const out = [];
  for (const s of [...make("alternates"), ...make("misspellings")]) {
    const key = s.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}
