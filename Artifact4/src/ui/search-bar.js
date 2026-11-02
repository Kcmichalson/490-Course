// Search bar: reports the words when he presses Enter or Search.

export function initSearchBar({ onSearch }) {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-words");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(input.value);
  });
  return {
    // Fills the box, e.g. when a saved search is loaded.
    setWords(text) {
      input.value = text;
    },
  };
}
