const filterButtons = document.querySelectorAll(".filter-button");
const searchInput = document.querySelector("#article-search");
const cards = document.querySelectorAll(".article-card");
const emptyState = document.querySelector("#empty-state");

let activeFilter = "all";

function updateArticles() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesCategory = activeFilter === "all" || card.dataset.category === activeFilter;
    const matchesSearch = !query || card.textContent.toLowerCase().includes(query);
    const isVisible = matchesCategory && matchesSearch;

    card.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
    else card.open = false;
  });

  emptyState.hidden = visibleCount > 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    updateArticles();
  });
});

searchInput.addEventListener("input", updateArticles);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    searchInput.focus();
  }
});
