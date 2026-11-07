// Keyword suggestion chips under the search bar (M5). Each chip is an
// alternate search ("Try: russell wilson rookie card"); clicking it reports
// the new Search for text. The suggestions come from src/core/keywords.js.

export function initSuggestions(container, { onPick }) {
  function render(suggestions) {
    container.replaceChildren();
    container.hidden = suggestions.length === 0;
    for (const s of suggestions) {
      const chip = document.createElement("button");
      chip.type = "button"; // inside the search form: must not submit it
      chip.className = "suggestion";
      chip.textContent = s.label;
      chip.addEventListener("click", () => onPick(s.text));
      container.append(chip);
    }
  }
  return { render };
}
