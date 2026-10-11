(function (N) {
  "use strict";
  var PREFIX = "noir:cache:", IMAGE_META = "noir:image-cache-meta", imageQueue = [], imageActive = 0,
    imageGeneration = 0, imageMemory = {}, imageOrder = [], activeLoads = [], MAX_ACTIVE = 3, MAX_OBJECT_URLS = 72;

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
  function cacheKey(key) { return PREFIX + String(key).replace(/[^a-z0-9:_-]/gi, "_"); }
  N.PersistentCache = {
    get: function (key) {
      var value = readJson(cacheKey(key), null);
      if (!value || !value.expiresAt || value.expiresAt <= Date.now()) { try { localStorage.removeItem(cacheKey(key)); } catch (e) {} return null; }
      return value.data;
    },
    set: function (key, data, ttl) {
      return writeJson(cacheKey(key), { createdAt: Date.now(), expiresAt: Date.now() + Math.max(1000, Number(ttl) || 60000), data: data });
    },
    cleanup: function () {
      var now = Date.now(), progressLimit = now - 180 * 86400000, completedLimit = now - 30 * 86400000, removed = 0, i, key, value;
      for (i = localStorage.length - 1; i >= 0; i -= 1) {
        key = localStorage.key(i); if (!key) continue;
        if (key.indexOf(PREFIX) === 0) {
          value = readJson(key, null);
          if (!value || !value.expiresAt || value.expiresAt <= now) { localStorage.removeItem(key); removed += 1; }
        } else if (key.indexOf("noir:") === 0 && key.indexOf(":progress:") > 0) {
          value = readJson(key, null);
          if (!value || Number(value.updatedAt || 0) < (value && value.completed ? completedLimit : progressLimit)) { localStorage.removeItem(key); removed += 1; }
        }
      }
      var meta = readJson(IMAGE_META, {}), urls = Object.keys(meta).sort(function (a, b) { return Number(meta[b]) - Number(meta[a]); });
      if (urls.length > 220) { urls.slice(220).forEach(function (url) { delete meta[url]; }); writeJson(IMAGE_META, meta); }
      try {
        if (window.caches && urls.length > 220) caches.open("cinema-noir-images-v1").then(function (cache) { urls.slice(220).forEach(function (url) { cache.delete(url); }); });
      } catch (ignoreCacheCleanup) {}
      return removed;
    }
  };

  function rememberObjectUrl(source, objectUrl) {
    if (!objectUrl) return source;
    imageMemory[source] = objectUrl; imageOrder.push(source);
    while (imageOrder.length > MAX_OBJECT_URLS) { var old = imageOrder.shift(), value = imageMemory[old]; delete imageMemory[old]; try { URL.revokeObjectURL(value); } catch (e) {} }
    return objectUrl;
  }
  function markImage(source) { var meta = readJson(IMAGE_META, {}); meta[source] = Date.now(); var keys = Object.keys(meta); if (keys.length > 240) keys.sort(function (a, b) { return meta[b] - meta[a]; }).slice(220).forEach(function (key) { delete meta[key]; }); writeJson(IMAGE_META, meta); }
  function cachedImage(source, done) {
    if (imageMemory[source]) return done(imageMemory[source]);
    try {
      if (!window.caches || !window.URL || !URL.createObjectURL) return done(source);
      caches.open("cinema-noir-images-v1").then(function (cache) { return cache.match(source); }).then(function (response) {
        if (!response) return done(source);
        return response.blob().then(function (blob) { done(rememberObjectUrl(source, URL.createObjectURL(blob))); });
      }).catch(function () { done(source); });
    } catch (e) { done(source); }
  }
  function cacheImage(source) {
    try {
      if (!window.caches || !window.fetch || !/^https?:/i.test(source)) return;
      caches.open("cinema-noir-images-v1").then(function (cache) { return cache.match(source).then(function (found) { if (!found) return fetch(source, { mode: "cors", cache: "force-cache" }).then(function (response) { if (response && response.ok) return cache.put(source, response.clone()); }); }); }).catch(function () {});
      markImage(source);
    } catch (e) {}
  }
  function pumpImages() {
    while (imageActive < MAX_ACTIVE && imageQueue.length) {
      (function (job) {
        if (!job.element || !document.documentElement.contains(job.element) || job.generation !== imageGeneration) return;
        imageActive += 1;
        cachedImage(job.source, function (resolved) {
          if (!document.documentElement.contains(job.element) || job.generation !== imageGeneration) { imageActive -= 1; pumpImages(); return; }
          var probe = new Image(), load = { probe: probe, done: false, timer: null };
          function finish(success) { if (load.done) return; load.done = true; clearTimeout(load.timer); var index = activeLoads.indexOf(load); if (index >= 0) activeLoads.splice(index, 1); if (success && document.documentElement.contains(job.element)) { job.element.src = resolved; job.element.classList.add("image-ready"); cacheImage(job.source); } else if (document.documentElement.contains(job.element)) job.element.src = "assets/fallback.svg"; imageActive = Math.max(0, imageActive - 1); pumpImages(); }
          load.cancel = function () { if (load.done) return; try { probe.src = ""; } catch (e) {} finish(false); };
          activeLoads.push(load); load.timer = setTimeout(function () { finish(false); }, 6000);
          probe.onload = function () { finish(true); };
          probe.onerror = function () { finish(false); };
          probe.src = resolved;
        });
      })(imageQueue.shift());
    }
  }
  N.loadImages = function (root) {
    imageGeneration += 1; imageQueue = []; activeLoads.slice().forEach(function (load) { load.cancel(); });
    var generation = imageGeneration, images = (root || document).querySelectorAll("img[data-src]"), i;
    for (i = 0; i < images.length; i += 1) if (images[i].dataset.src) imageQueue.push({ element: images[i], source: images[i].dataset.src, generation: generation });
    pumpImages();
  };
  N.cleanupOldData = function () { return N.PersistentCache.cleanup(); };
})(window.Noir || (window.Noir = {}));
