// Search bar: reports the search when he presses Enter or Search. The
// Leave out box (#exclude) is in the same form; its value is read with the
// sidebar's filters.

export function initSearchBar({ onSearch }) {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-words");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(input.value);
  });
}
