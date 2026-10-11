(function (N) {
  "use strict";
  var pages = {}, stack = [];
  try { pages = JSON.parse(sessionStorage.getItem("noir:focus-history") || "{}") || {}; } catch (e) {}
  try { stack = JSON.parse(sessionStorage.getItem("noir:navigation-stack") || "[]") || []; } catch (e) {}
  function pageName() { return location.hash.replace(/^#\//, "").split("/")[0] || "home"; }
  function storageKey(page) { return ((N.active && N.active.id) || "none") + ":" + (page || pageName()); }
  var persistTimer = null;
  function persist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    try { sessionStorage.setItem("noir:focus-history", JSON.stringify(pages)); sessionStorage.setItem("noir:navigation-stack", JSON.stringify(stack.slice(-30))); } catch (e) {}
  }
  function persistSoon() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 500);
  }
  function findTrack(element) {
    var current = element;
    while (current) {
      if (current.classList && (
        current.classList.contains("media-grid") || current.classList.contains("category-list") ||
        current.classList.contains("episode-grid") || current.classList.contains("season-list") ||
        current.classList.contains("vertical-track") || current.classList.contains("horizontal-track")
      )) return current;
      current = current.parentNode;
    }
    return null;
  }
  function offsets(track) {
    return { offsetY: Number(track && track.dataset.offsetY || 0), offsetX: Number(track && track.dataset.offsetX || 0) };
  }

  N.focusHistory = {
    pages: pages,
    pageName: pageName,
    get: function (page) { return pages[storageKey(page)] || {}; },
    patch: function (page, patch) { var k = storageKey(page); pages[k] = Object.assign({}, pages[k] || {}, patch || {}); persistSoon(); return pages[k]; },
    capture: function (page) {
      var el = N.getFocused ? N.getFocused() : document.activeElement, track = el && findTrack(el);
      var patch = { focusKey: el && el.id || null, region: track && (track.dataset.region || track.id) || null };
      if (track) Object.assign(patch, offsets(track));
      if (track && track.dataset.region === "categories") patch.categoryOffsetY = Number(track.dataset.offsetY || 0);
      if (track && track.dataset.region === "channels") patch.channelOffsetY = Number(track.dataset.offsetY || 0);
      if (el && el.dataset.index !== undefined) patch.itemIndex = Number(el.dataset.index);
      if (el && el.dataset.index !== undefined && track && track.classList.contains("media-grid-track")) { var columns = getComputedStyle(track).gridTemplateColumns.split(" ").length || 1; patch.row = Math.floor(Number(el.dataset.index) / columns); patch.column = Number(el.dataset.index) % columns; }
      if (el && el.classList.contains("category-item")) patch.focusedCategoryId = el.dataset.value;
      if (el && el.classList.contains("season-button")) patch.focusedSeason = el.dataset.value;
      return this.patch(page, patch);
    },
    save: function (el) {
      if (!el) return;
      var track = findTrack(el), patch = { focusKey: el.id || null, region: track && (track.dataset.region || track.id) || null };
      if (track) Object.assign(patch, offsets(track));
      if (track && track.dataset.region === "categories") patch.categoryOffsetY = Number(track.dataset.offsetY || 0);
      if (track && track.dataset.region === "channels") patch.channelOffsetY = Number(track.dataset.offsetY || 0);
      if (el.dataset && el.dataset.index !== undefined) patch.itemIndex = Number(el.dataset.index);
      if (el.dataset && el.dataset.index !== undefined && track && track.classList.contains("media-grid-track")) { var columns = getComputedStyle(track).gridTemplateColumns.split(" ").length || 1; patch.row = Math.floor(Number(el.dataset.index) / columns); patch.column = Number(el.dataset.index) % columns; }
      if (el.classList && el.classList.contains("category-item")) patch.focusedCategoryId = el.dataset.value;
      if (el.classList && el.classList.contains("season-button")) patch.focusedSeason = el.dataset.value;
      this.patch(pageName(), patch);
    },
    restore: function (page) {
      var state = this.get(page), regionKey = state && state.region;
      if (regionKey) {
        var regionNode = document.querySelector('[data-region="' + regionKey + '"]');
        if (regionNode) {
          var x = Number(state.offsetX || 0), y = Number(state.offsetY || state.categoryOffsetY || state.channelOffsetY || 0);
          regionNode.dataset.offsetY = y; regionNode.dataset.offsetX = x;
          if (regionNode._scroller) regionNode._scroller.setY(y);
          regionNode.style.transform = "translate3d(" + (-x) + "px," + (-y) + "px,0)";
        }
      }
      var el = state.focusKey && document.getElementById(state.focusKey);
      if (el) { N.focus(el, true); return true; }
      return false;
    },
    pushRoute: function (page) { stack.push({ page: page || pageName(), state: this.capture(page), hash: location.hash }); persist(); },
    popRoute: function () { var value = stack.pop() || null; persist(); return value; }
  };
  N.NavigationStack = stack;
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
})(Noir);
