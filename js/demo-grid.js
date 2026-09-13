(function (N) {
  "use strict";
  var movies = [], memory = {}, category = "all", grid = document.getElementById("movieGrid");
  for (var i = 0; i < 43; i++) movies.push({ id: i, title: "Filme fictício " + (i + 1), category: i % 2 ? "drama" : "action", poster: "assets/fallback.svg" });
  window.demoMovies = movies;
  window.loadCategory = function (name) {
    if (grid._scroller) memory[category] = { index: N.FocusManager.currentIndex, scrollY: grid._scroller.currentY };
    category = name;
    var filtered = movies.filter(function (m) { return name === "all" || m.category === name; });
    grid.innerHTML = "";
    filtered.forEach(function (m, index) {
      var card = document.createElement("div");
      card.className = "movie-card poster"; card.dataset.focusable = "true"; card.dataset.index = index; card.id = "demo-" + m.id;
      card.innerHTML = '<img src="' + m.poster + '" alt=""><div class="movie-title">' + m.title + '</div>';
      card.onclick = function () { document.getElementById("detail").textContent = "Detalhes: " + m.title + " · conteúdo fictício"; };
      grid.appendChild(card);
    });
    grid._scroller = null; grid.dataset.offsetY = 0;
    var state = memory[name] || {index:0,scrollY:0}, scroller = N.getGridScroller(grid);
    scroller.refresh(filtered.length); scroller.setY(state.scrollY);
    N.focus(grid.children[Math.min(state.index, filtered.length - 1)]);
  };
  ["all","action","drama"].forEach(function (name) { document.getElementById(name).onclick = function () { window.loadCategory(name); }; });
  window.loadCategory("all");
})(Noir);
