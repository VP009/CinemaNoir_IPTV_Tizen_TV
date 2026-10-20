(function (N) {
  "use strict";
  var selector = ".media-grid,.category-list,.episode-grid,.season-list,.vertical-track,.horizontal-track";
  function parent(el) {
    while (el && el !== document.body) {
      if (el.matches && el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function items(track) {
    if (!track) return [];
    var children = track.children, count = children.length, first = count ? children[0] : null, last = count ? children[count - 1] : null;
    if (track._focusItems && track._focusChildCount === count && track._focusFirst === first && track._focusLast === last) return track._focusItems;
    track._focusItems = Array.prototype.filter.call(children, function (el) { return el.tagName === "BUTTON" || el.getAttribute("data-focusable") === "true"; });
    track._focusChildCount = count; track._focusFirst = first; track._focusLast = last;
    return track._focusItems;
  }
  function bind(track, list) {
    list = list || items(track);
    if (!list.length) return null;
    if (!track._scroller || track._itemCount !== list.length || track._firstItem !== list[0]) {
      var style = getComputedStyle(track), horizontal = track.classList.contains("season-list") || track.classList.contains("horizontal-track");
      var template = style.gridTemplateColumns || "none", repeatMatch = /repeat\(\s*(\d+)/.exec(template);
      var cols = horizontal ? list.length : Math.max(1, template === "none" ? 1 : repeatMatch ? Number(repeatMatch[1]) : template.split(/\s+/).length);
      var measuredGap = track.id === "categories" ? parseFloat(getComputedStyle(list[0]).marginBottom) || 0 : parseFloat(style.rowGap || style.gridRowGap) || 0;
      track._scroller = new N.GridScroller({ track: track, columns: cols, cardHeight: list[0].offsetHeight || 320,
        cardWidth: list[0].offsetWidth || 220, rowGap: measuredGap,
        columnGap: parseFloat(style.columnGap || style.gridColumnGap) || 0, safeMargin: 40, totalItems: track._virtualTotal || list.length, currentY: Number(track.dataset.offsetY || 0) });
      track._horizontal = horizontal; track._itemCount = list.length; track._firstItem = list[0];
    }
    return track._scroller;
  }
  function itemIndex(track, list, el) {
    var localIndex = list ? list.indexOf(el) : -1;
    if (track && track._virtualTotal && el && el.dataset && el.dataset.index !== undefined) {
      var globalIndex = Number(el.dataset.index);
      if (isFinite(globalIndex) && globalIndex >= 0) return globalIndex;
    }
    return localIndex;
  }
  N.activeFocus = null; N.previousFocusElement = null;
  N.getFocused = function () { return N.activeFocus && document.documentElement.contains(N.activeFocus) ? N.activeFocus : null; };
  N.focusables = function () {
    var scope = document.querySelector(".tv-modal,.keyboard") || document.querySelector(".player") || document.getElementById("app");
    return scope ? Array.prototype.filter.call(scope.querySelectorAll('button:not(:disabled),input:not(:disabled),[data-focusable="true"]'), function (el) { return el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== "hidden"; }) : [];
  };
  N.follow = function (el, knownTrack, knownList, knownIndex, knownScroller) {
    var track = knownTrack || parent(el), list = knownList || (track && items(track)), scroller = knownScroller || (track && bind(track, list));
    if (!scroller) return;
    var index = knownIndex === undefined ? itemIndex(track, list, el) : knownIndex;
    if (track.id === "categories") N.ensureCategoryVisible(index);
    else if (track.id === "catalog" && !track.closest(".live-layout")) N.ensureSeriesVisible(index);
    else if (track.id === "episodes" && N.ensureEpisodeVisible) N.ensureEpisodeVisible(index);
    else if (!track._horizontal) scroller.ensureVisible(index);
    else {
      var left = index * (scroller.cardWidth + scroller.columnGap), x = Number(track.dataset.offsetX || 0), width = track.parentElement.clientWidth;
      if (left < x + 20) x = left - 20;
      else if (left + scroller.cardWidth > x + width - 20) x = left + scroller.cardWidth - width + 20;
      x = Math.max(0, Math.min(Math.max(0, track.scrollWidth - width), x));
      track.dataset.offsetX = x; track.style.transform = "translate3d(" + (-x) + "px,0,0)";
    }
  };
  N.focus = function (el) {
    if (!el || !document.documentElement.contains(el)) return false;
    var old = N.activeFocus;
    if (old && old !== el) { old.classList.remove("focused"); old.removeAttribute("data-focused"); }
    if (document.activeElement && document.activeElement !== el && document.activeElement !== document.body && document.activeElement.blur) {
      document.activeElement.blur();
    }
    N.activeFocus = el; el.classList.add("focused"); el.setAttribute("data-focused", "true");
    var track = parent(el), list = track && items(track), scroller = track && bind(track, list), index = track ? itemIndex(track, list, el) : -1;
    if (track && scroller) { N.FocusManager.currentIndex = index; N.FocusManager.columns = scroller.columns; track._lastFocus = el.id; }
    N.follow(el, track, list, index, scroller);
    if (!el.closest(".player,.keyboard,.tv-modal") && N.focusHistory) N.focusHistory.save(el);
    if (old !== el && typeof el.onfocus === "function") el.onfocus();
    return true;
  };
  N.rememberFocus = function () { N.previousFocusElement = N.getFocused(); };
  N.restorePreviousFocus = function () { var el = N.previousFocusElement; N.previousFocusElement = null; return N.focus(el) || N.focusHistory.restore(); };
  N.ensureFocus = function () { return N.getFocused() || N.focusHistory.restore() || N.focus(N.focusables()[0]); };
  N.FocusManager = window.FocusManager = {
    currentIndex: 0, columns: 6,
    focus: function (index) { var track = parent(N.getFocused()) || document.getElementById("catalog") || document.getElementById("movieGrid"); return track ? (track._focusVirtualIndex ? track._focusVirtualIndex(index) : N.focus(items(track)[index])) : false; },
    moveLeft: function () { N.moveFocus(37); }, moveRight: function () { N.moveFocus(39); },
    moveUp: function () { N.moveFocus(38); }, moveDown: function () { N.moveFocus(40); }
  };
  N.getGridScroller = bind;
  N.getTrackItems = items;
  document.addEventListener("click", function (e) { var el = e.target; while (el && el !== document.body) { if (el.tagName === "BUTTON" || el.getAttribute("data-focusable") === "true" || el.tagName === "INPUT") { N.focus(el); break; } el = el.parentElement; } }, true);
  window.addEventListener("resize", function () { var tracks = document.querySelectorAll(selector); for (var i = 0; i < tracks.length; i++) { tracks[i]._scroller = null; tracks[i]._focusItems = null; } if (N.getFocused()) N.follow(N.getFocused()); });
})(Noir);
