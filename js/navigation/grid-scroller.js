(function (N) {
  "use strict";
  var SERIES_ROW_HEIGHT = 352;
  var CATEGORY_ROW_HEIGHT = 90;
  var EPISODE_ROW_HEIGHT = 120;

  function numberAttribute(element, name) {
    return parseInt(element && element.getAttribute(name), 10) || 0;
  }

  function clampTrackY(viewport, track, y) {
    if (!viewport || !track) return 0;
    var maxY = track._scroller ? track._scroller.getMaxY() : Math.max(0, track.scrollHeight - viewport.clientHeight);
    return Math.max(0, Math.min(maxY, Number(y) || 0));
  }

  function setSeriesY(y) {
    var grid = document.getElementById("catalog");
    var viewport = grid && grid.parentElement || document.querySelector(".grid-scroll");
    if (!viewport || !grid) return 0;
    y = clampTrackY(viewport, grid, y);
    grid.setAttribute("data-offset-y", String(y));
    grid.style.transform = "translate3d(0px," + (-y) + "px,0px)";
    if (grid._scroller) grid._scroller.currentY = y;
    return y;
  }

  function setCategoryY(y) {
    var list = document.getElementById("categories");
    var viewport = list && list.parentElement || document.querySelector(".category-scroll");
    if (!viewport || !list) return 0;
    y = clampTrackY(viewport, list, y);
    list.setAttribute("data-offset-y", String(y));
    list.style.transform = "translate3d(0px," + (-y) + "px,0px)";
    if (list._scroller) list._scroller.currentY = y;
    return y;
  }

  function setEpisodeY(y) {
    var list = document.getElementById("episodes");
    var viewport = list && list.parentElement || document.querySelector(".episode-scroll");
    if (!viewport || !list) return 0;
    y = clampTrackY(viewport, list, y);
    list.setAttribute("data-offset-y", String(y));
    list.style.transform = "translate3d(0px," + (-y) + "px,0px)";
    if (list._scroller) list._scroller.currentY = y;
    return y;
  }

  function ensureSeriesVisible(index) {
    var grid = document.getElementById("catalog");
    var viewport = grid && grid.parentElement || document.querySelector(".grid-scroll");
    if (!viewport || !grid || index < 0) return 0;
    var columns = grid._scroller && grid._scroller.columns || 6;
    var row = Math.floor(index / columns);
    var rowTop = row * SERIES_ROW_HEIGHT;
    var rowBottom = rowTop + 320;
    var currentY = numberAttribute(grid, "data-offset-y");
    var safeMargin = 40;
    var newY = currentY;
    if (rowBottom > currentY + viewport.clientHeight - safeMargin) {
      newY = rowBottom - viewport.clientHeight + safeMargin;
    } else if (rowTop < currentY + safeMargin) {
      newY = rowTop - safeMargin;
    }
    return setSeriesY(newY);
  }

  function ensureCategoryVisible(index) {
    var list = document.getElementById("categories");
    var viewport = list && list.parentElement || document.querySelector(".category-scroll");
    if (!viewport || !list || index < 0) return 0;
    var itemTop = index * CATEGORY_ROW_HEIGHT;
    var itemBottom = itemTop + 76;
    var currentY = numberAttribute(list, "data-offset-y");
    var safeMargin = 30;
    var newY = currentY;
    if (itemBottom > currentY + viewport.clientHeight - safeMargin) {
      newY = itemBottom - viewport.clientHeight + safeMargin;
    } else if (itemTop < currentY + safeMargin) {
      newY = itemTop - safeMargin;
    }
    return setCategoryY(newY);
  }

  function ensureEpisodeVisible(index) {
    var list = document.getElementById("episodes");
    var viewport = list && list.parentElement || document.querySelector(".episode-scroll");
    if (!viewport || !list || index < 0) return 0;
    var itemTop = index * EPISODE_ROW_HEIGHT;
    var itemBottom = itemTop + 104;
    var currentY = numberAttribute(list, "data-offset-y");
    var safeMargin = 28;
    var newY = currentY;
    if (itemBottom > currentY + viewport.clientHeight - safeMargin) {
      newY = itemBottom - viewport.clientHeight + safeMargin;
    } else if (itemTop < currentY + safeMargin) {
      newY = itemTop - safeMargin;
    }
    return setEpisodeY(newY);
  }

  N.SERIES_ROW_HEIGHT = window.SERIES_ROW_HEIGHT = SERIES_ROW_HEIGHT;
  N.CATEGORY_ROW_HEIGHT = window.CATEGORY_ROW_HEIGHT = CATEGORY_ROW_HEIGHT;
  N.EPISODE_ROW_HEIGHT = window.EPISODE_ROW_HEIGHT = EPISODE_ROW_HEIGHT;
  N.setSeriesY = window.setSeriesY = setSeriesY;
  N.setCategoryY = window.setCategoryY = setCategoryY;
  N.setEpisodeY = window.setEpisodeY = setEpisodeY;
  N.ensureSeriesVisible = window.ensureSeriesVisible = ensureSeriesVisible;
  N.ensureCategoryVisible = window.ensureCategoryVisible = ensureCategoryVisible;
  N.ensureEpisodeVisible = window.ensureEpisodeVisible = ensureEpisodeVisible;
  N.TV_METRICS = { seriesRowHeight: SERIES_ROW_HEIGHT, categoryRowHeight: CATEGORY_ROW_HEIGHT, episodeRowHeight: EPISODE_ROW_HEIGHT };
  N.debugTvLayout = window.debugTvLayout = function () {
    var selectors = [".catalog-layout", ".category-scroll", "#categories", ".grid-scroll", "#catalog", ".poster", ".episode-scroll", "#episodes"], result = {
      inner: [window.innerWidth, window.innerHeight],
      screen: window.screen ? [window.screen.width, window.screen.height] : null,
      dpr: window.devicePixelRatio || 1,
      metrics: N.TV_METRICS,
      elements: {}
    };
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      result.elements[selectors[i]] = element ? { clientWidth: element.clientWidth, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight } : null;
    }
    if (window.console && console.log) console.log("TV LAYOUT DEBUG", result);
    return result;
  };
  if (window.console && console.log && typeof window.innerWidth === "number") {
    console.log("TV DISPLAY", "inner:", window.innerWidth, window.innerHeight, "screen:", window.screen && window.screen.width, window.screen && window.screen.height, "DPR:", window.devicePixelRatio);
  }
  function GridScroller(options) { this.init(options || {}); }
  GridScroller.prototype = {
    init: function (o) {
      this.track = o.track; this.viewport = o.viewport || (o.track && o.track.parentElement);
      this.columns = o.columns || 6; this.cardHeight = o.cardHeight || 320;
      this.cardWidth = o.cardWidth || 220; this.columnGap = o.columnGap === undefined ? 28 : o.columnGap;
      this.rowGap = o.rowGap === undefined ? 32 : o.rowGap; this.safeMargin = o.safeMargin === undefined ? 70 : o.safeMargin;
      this.totalItems = o.totalItems || 0; this.viewportHeight = o.viewportHeight || (this.viewport && this.viewport.clientHeight) || 780;
      this.currentY = o.currentY || 0; this.setY(this.currentY); return this;
    },
    getRowHeight: function () { return this.cardHeight + this.rowGap; },
    getRowFromIndex: function (i) { return Math.floor(i / this.columns); },
    getTotalRows: function () { return Math.ceil(this.totalItems / this.columns); },
    getContentHeight: function () { return Math.max(0, this.getTotalRows() * this.getRowHeight() - this.rowGap); },
    getMaxY: function () { return Math.max(0, this.getContentHeight() - this.viewportHeight); },
    clamp: function (y) { return Math.max(0, Math.min(this.getMaxY(), Number(y) || 0)); },
    setY: function (y) { this.currentY = this.clamp(y); this.apply(); },
    apply: function () { if (this.track) { this.track.dataset.offsetY = this.currentY; this.track.style.transform = "translate3d(0," + (-this.currentY) + "px,0)"; } },
    ensureVisible: function (i) {
      if (i < 0 || i >= this.totalItems) return;
      var top = this.getRowFromIndex(i) * this.getRowHeight(), bottom = top + this.cardHeight;
      var margin = Math.min(this.safeMargin, Math.max(0, (this.viewportHeight - this.cardHeight) / 2));
      if (top < this.currentY + margin) this.setY(top - margin);
      else if (bottom > this.currentY + this.viewportHeight - margin) this.setY(bottom - this.viewportHeight + margin);
    },
    refresh: function (total) { this.totalItems = total; if (this.viewport) this.viewportHeight = this.viewport.clientHeight; this.setY(this.currentY); }
  };
  N.GridScroller = window.GridScroller = GridScroller;
})(window.Noir || (window.Noir = {}));
