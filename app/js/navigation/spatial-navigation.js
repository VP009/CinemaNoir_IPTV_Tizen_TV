(function (N) {
  "use strict";

  function hasClass(el, name) {
    return !!(el && el.classList && el.classList.contains(name));
  }

  function findParentByClass(element, className) {
    var current = element;
    while (current) {
      if (current.classList && current.classList.contains(className)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function visible(el) {
    if (!el) return false;
    var style;
    try { style = window.getComputedStyle(el); } catch (e) { return false; }
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0;
  }

  function moveFromInput(current, direction) {
    if (!current || (current.tagName !== "INPUT" && current.tagName !== "TEXTAREA")) return false;
    var list = N.focusables();
    var index = list.indexOf(current);
    if (index < 0) return false;

    if (direction === "down" || direction === "right") {
      for (var i = index + 1; i < list.length; i += 1) {
        if (list[i] !== current && visible(list[i])) {
          N.focus(list[i]);
          return true;
        }
      }
    } else if (direction === "up" || direction === "left") {
      for (var j = index - 1; j >= 0; j -= 1) {
        if (list[j] !== current && visible(list[j])) {
          N.focus(list[j]);
          return true;
        }
      }
    }

    return false;
  }

  function getGridItems(grid) {
    if (!grid) return [];
    if (N.getTrackItems) return N.getTrackItems(grid);
    var nodes = grid.children;
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if ((nodes[i].tagName === "BUTTON" || nodes[i].getAttribute("data-focusable") === "true") && visible(nodes[i])) result.push(nodes[i]);
    }
    return result;
  }

  function getColumns(items) {
    if (!items || !items.length) return 1;
    if (items[0].parentElement._virtualColumns) return items[0].parentElement._virtualColumns;
    if (items.length < 2) return 1;
    return N.getGridScroller(items[0].parentElement).columns;
  }

  function isFirstColumn(items, index, columns) {
    return index >= 0 && index % columns === 0;
  }

  function getSelectedCategory(grid) {
    var layout = findParentByClass(grid, "catalog-layout");
    if (!layout) return null;
    return layout.querySelector('.category-item[data-selected="true"]') ||
      layout.querySelector('.category-item[data-focused="true"]') ||
      layout.querySelector(".category-item");
  }

  function moveGrid(current, grid, direction) {
    var items = getGridItems(grid);
    if (!items.length) return false;

    var localIndex = items.indexOf(current), index = current.dataset && current.dataset.index !== undefined ? Number(current.dataset.index) : localIndex;
    if (localIndex < 0 || index < 0) return false;

    var columns = getColumns(items);
    var targetIndex = index, total = grid._virtualTotal || items.length;

    if (direction === "left") {
      if (isFirstColumn(items, index, columns)) {
        var category = getSelectedCategory(grid);
        if (category) {
          N.focus(category);
          return true;
        }
        return true;
      }
      targetIndex = index - 1;
    } else if (direction === "right") {
      if ((index + 1) % columns !== 0 && index + 1 < total) targetIndex = index + 1;
      else return true;
    } else if (direction === "up") {
      targetIndex = index - columns;
      if (targetIndex < 0) return true;
    } else if (direction === "down") {
      targetIndex = index + columns;
      if (targetIndex >= total) {
        var last = total - 1;
        var candidate = last - (last % columns);
        if (candidate > index) targetIndex = last;
        else return true;
      }
    }

    if (targetIndex < 0 || targetIndex >= total) return true;
    if (targetIndex === index) return true;

    if (grid._focusVirtualIndex) {
      var renderedTarget = grid.querySelector('.poster[data-index="' + targetIndex + '"]');
      if (renderedTarget) N.focus(renderedTarget); else grid._focusVirtualIndex(targetIndex);
    } else N.focus(items[targetIndex]);
    return true;
  }

  function moveVerticalList(current, container, direction) {
    if (!container) return false;
    var track = findParentByClass(current, "category-list") || container.querySelector(".category-list"),
      visibleItems = track && N.getTrackItems ? N.getTrackItems(track) : Array.prototype.slice.call(container.querySelectorAll("button,[data-focusable='true']"));
    var index = visibleItems.indexOf(current);
    if (index < 0) return false;

    if (direction === "up") {
      if (index > 0) {
        N.focus(visibleItems[index - 1]);
        return true;
      }
      return false;
    }

    if (direction === "down") {
      if (index + 1 < visibleItems.length) {
        N.focus(visibleItems[index + 1]);
        return true;
      }
      return false;
    }

    return false;
  }

  function moveHorizontalList(current, container, direction) {
    if (!container) return false;
    var track = findParentByClass(current, "season-list") || findParentByClass(current, "horizontal-track"),
      items = track && N.getTrackItems ? N.getTrackItems(track) : Array.prototype.slice.call(container.querySelectorAll("button,[data-focusable='true']"));
    var index = items.indexOf(current);
    if (index < 0) return false;

    if (direction === "left" && index > 0) {
      N.focus(items[index - 1]);
      return true;
    }

    if (direction === "right" && index + 1 < items.length) {
      N.focus(items[index + 1]);
      return true;
    }

    return true;
  }

  function geometricMove(current, list, direction) {
    var currentRect = current.getBoundingClientRect();
    var cx = currentRect.left + currentRect.width / 2;
    var cy = currentRect.top + currentRect.height / 2;
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < list.length; i += 1) {
      var el = list[i];
      if (el === current || !visible(el)) continue;
      var rect = el.getBoundingClientRect();
      var ex = rect.left + rect.width / 2;
      var ey = rect.top + rect.height / 2;
      var dx = ex - cx;
      var dy = ey - cy;
      var primary = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
      if (primary <= 4) continue;
      var cross = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
      var score = primary + cross * 1.4;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      N.focus(best);
      return true;
    }
    return false;
  }

  N.moveFocus = function (code) {
    var current = N.getFocused();

    if (!current || current === document.body) {
      var list = N.focusables();
      if (list.length) N.focus(list[0]);
      return;
    }

    var direction = null;
    if (code === 37) direction = "left";
    else if (code === 38) direction = "up";
    else if (code === 39) direction = "right";
    else if (code === 40) direction = "down";

    if (!direction) return;

    if (moveFromInput(current, direction)) return;

    var grid = findParentByClass(current, "media-grid");
    if (grid) {
      if (direction === "up") {
        var gridItems = getGridItems(grid);
        var gridIndex = current.dataset && current.dataset.index !== undefined ? Number(current.dataset.index) : gridItems.indexOf(current);
        var gridColumns = getColumns(gridItems);
        if (gridIndex >= 0 && gridIndex < gridColumns) {
          var aboveTarget = document.getElementById("filter") ||
            document.getElementById("global-search");
          if (aboveTarget) {
            N.focus(aboveTarget);
            return;
          }
        }
      }

      if (moveGrid(current, grid, direction)) return;
    }

    var episodeGrid = findParentByClass(current, "episode-grid");
    if (episodeGrid) {
      if (direction === "up") {
        var episodeItems = getGridItems(episodeGrid);
        var episodeIndex = episodeItems.indexOf(current);
        if (episodeIndex <= 0) {
          var seasons = document.querySelector('.season-button[data-selected="true"]') || document.querySelector("#seasons .season-button");
          if (seasons) {
            N.focus(seasons);
            return;
          }
        }
      }

      if (moveGrid(current, episodeGrid, direction)) return;
    }

    var categoryContainer = findParentByClass(current, "category-scroll");
    if (categoryContainer) {
      if (direction === "right") {
        var catalog = document.getElementById("catalog");
        var firstCard = catalog && catalog._lastFocus && document.getElementById(catalog._lastFocus);
        if (!firstCard && catalog && catalog._focusVirtualIndex && catalog.dataset.lastIndex) { catalog._focusVirtualIndex(Number(catalog.dataset.lastIndex)); return; }
        if (!firstCard) firstCard = document.querySelector("#catalog .poster");
        if (firstCard) {
          N.focus(firstCard);
        }
        return;
      }

      if (direction === "up" || direction === "down") {
        if (moveVerticalList(current, categoryContainer, direction)) return;
      }
    }

    var seasonContainer = findParentByClass(current, "season-scroll");
    if (seasonContainer) {
      if (direction === "left" || direction === "right") {
        moveHorizontalList(current, seasonContainer, direction);
        return;
      }

      if (direction === "down") {
        var firstEpisode = document.querySelector("#episodes .episode");
        if (firstEpisode) {
          N.focus(firstEpisode);
        }
        return;
      }
    }

    var episodeContainer = findParentByClass(current, "episode-scroll");
    if (episodeContainer) {
      var episodeGrid2 = findParentByClass(current, "episode-grid");
      if (episodeGrid2) {
        if (moveGrid(current, episodeGrid2, direction)) return;
      }

      if (direction === "up") {
        var seasons = document.querySelector('.season-button[data-selected="true"]') || document.querySelector("#seasons .season-button");
        if (seasons) {
          N.focus(seasons);
        }
        return;
      }
    }

    var explicitId = current.getAttribute("data-nav-" + direction);
    var explicitTarget = explicitId && document.getElementById(explicitId);
    if (explicitTarget) {
      N.focus(explicitTarget);
      return;
    }

    if (geometricMove(current, N.focusables(), direction)) return;
    N.ensureFocus();
  };
})(Noir);
