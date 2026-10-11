(function (N) {
  "use strict";
  var app = null, currentItems = [], liveEpgTimer = null, liveEpgToken = 0, liveEpgRequest = null;
  function getApp() {
    if (!app) app = document.getElementById("app");
    if (!app) throw new Error("Elemento app não encontrado após o carregamento da página.");
    return app;
  }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function icon(name) {
    return iconHtml(name, "ui-icon");
  }
  function normalize(s) {
    s = String(s || "").toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
  }
  function decodeEpgText(value) {
    value = String(value || "");
    if (!value) return "";
    try { return decodeURIComponent(escape(atob(value))); } catch (ignore) { return value; }
  }
  function epgTime(value, fallback) {
    var numeric = Number(value), date = numeric ? new Date(numeric < 1000000000000 ? numeric * 1000 : numeric) : new Date(String(fallback || "").replace(/-/g, "/"));
    if (isNaN(date.getTime())) return "--:--";
    return (date.getHours() < 10 ? "0" : "") + date.getHours() + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes();
  }
  function showLiveSelection(item) {
    var preview = document.getElementById("live-preview"), name = document.getElementById("live-selected-name"), logo = document.getElementById("live-mini-logo"), epg = document.getElementById("live-epg");
    if (!preview || !item) return;
    if (name) name.textContent = item.name || "Canal";
    if (logo) logo.src = item.stream_icon || "assets/fallback.svg";
    clearTimeout(liveEpgTimer);
    if (liveEpgRequest && liveEpgRequest.abort) liveEpgRequest.abort();
    liveEpgRequest = null;
    var token = ++liveEpgToken;
    liveEpgTimer = setTimeout(function () {
      if (epg) epg.classList.add("epg-stale");
      liveEpgRequest = N.epg(item, 5);
      liveEpgRequest.then(function (list) {
        if (token !== liveEpgToken || !document.getElementById("live-epg")) return;
        var now = Date.now() / 1000, future = list.filter(function (entry) { return !entry.stop_timestamp || Number(entry.stop_timestamp) >= now; }).slice(0, 4);
        if (!future.length) future = list.slice(0, 4);
        epg.innerHTML = future.map(function (entry, index) {
          var title = decodeEpgText(entry.title) || "Programa sem título", description = decodeEpgText(entry.description);
          return '<div class="epg-item' + (index === 0 ? " epg-now" : "") + '"><span>' + (index === 0 ? "Agora" : epgTime(entry.start_timestamp, entry.start)) + '</span><div><strong>' + esc(title) + '</strong>' + (description ? '<small>' + esc(description) + '</small>' : "") + "</div></div>";
        }).join("") || '<div class="epg-empty">Programação não disponível.</div>';
        epg.classList.remove("epg-stale"); liveEpgRequest = null;
      }).catch(function (error) { if (token === liveEpgToken && epg && (!error || error.message !== "cancelled")) { epg.classList.remove("epg-stale"); epg.innerHTML = '<div class="epg-empty">Programação não disponível.</div>'; } });
    }, 480);
  }
  function buildEpisodeOptions(seriesItem, seasons, episode, requestedSeason) {
    seasons = seasons || {};
    var keys = Object.keys(seasons).sort(function (a, b) { return Number(a) - Number(b); }),
      episodeId = N.contentId(episode), seasonKey = String(requestedSeason || episode.season || ""), seasonIndex, list, episodeIndex = -1;
    if (!seasons[seasonKey]) {
      for (var k = 0; k < keys.length && episodeIndex < 0; k += 1) {
        list = seasons[keys[k]] || [];
        for (var e = 0; e < list.length; e += 1) if (N.contentId(list[e]) === episodeId) { seasonKey = keys[k]; episodeIndex = e; episode = list[e]; break; }
      }
    }
    seasonIndex = keys.indexOf(seasonKey);
    list = seasons[seasonKey] || [];
    if (episodeIndex < 0) for (var i = 0; i < list.length; i += 1) if (N.contentId(list[i]) === episodeId) { episodeIndex = i; episode = list[i]; break; }
    var prev = episodeIndex > 0 ? list[episodeIndex - 1] : null,
      next = episodeIndex >= 0 && episodeIndex < list.length - 1 ? list[episodeIndex + 1] : null,
      prevSeasonKey = seasonKey, nextSeasonKey = seasonKey;
    if (!prev && seasonIndex > 0) for (var p = seasonIndex - 1; p >= 0 && !prev; p -= 1) {
      var prevList = seasons[keys[p]] || [];
      if (prevList.length) { prev = prevList[prevList.length - 1]; prevSeasonKey = keys[p]; }
    }
    if (!next && seasonIndex >= 0) for (var n = seasonIndex + 1; n < keys.length && !next; n += 1) {
      var nextList = seasons[keys[n]] || [];
      if (nextList.length) { next = nextList[0]; nextSeasonKey = keys[n]; }
    }
    function open(target, targetSeason) {
      N.openPlayer("episode", target, target.title || seriesItem.name, buildEpisodeOptions(seriesItem, seasons, target, target.season || targetSeason));
    }
    return {
      seriesId: N.contentId(seriesItem), seriesName: seriesItem.name, seriesPoster: seriesItem.cover,
      seasonNumber: seasonKey, prevItem: prev, nextItem: next,
      nextSeasonNumber: next ? next.season || nextSeasonKey : null,
      prev: prev ? function () { open(prev, prevSeasonKey); } : null,
      next: next ? function () { open(next, nextSeasonKey); } : null
    };
  }
  function resumeEpisode(record) {
    var seriesItem = { series_id: record.seriesId, name: record.seriesName || record.title || "Série", cover: record.seriesPoster },
      episode = record.item;
    N.toast("Carregando episódios…");
    N.request(N.active, "get_series_info", { series_id: record.seriesId }).then(function (info) {
      var seasons = info.episodes || {}, options = buildEpisodeOptions(seriesItem, seasons, episode, record.seasonNumber || episode.season);
      N.openPlayer("episode", episode, record.title || seriesItem.name, options);
    }).catch(function () {
      N.openPlayer("episode", episode, record.title || seriesItem.name, { seriesId: record.seriesId, seriesName: seriesItem.name, seriesPoster: seriesItem.cover, seasonNumber: record.seasonNumber || episode.season });
    });
  }
  function header() {
    return '<header class="home-status-bar"><span id="clock"></span></header>';
  }
  function expirationBadge() {
    if (!N.active) return "";
    var account = N.active.account || {}, raw = Number(account.exp_date), label;
    if (!raw) label = "Sem data de expiração";
    else {
      var date = new Date(raw < 1000000000000 ? raw * 1000 : raw);
      label = isNaN(date.getTime())
        ? "Data de expiração indisponível"
        : "Expira em " + (date.getDate() < 10 ? "0" : "") + date.getDate() + "/" + (date.getMonth() + 1 < 10 ? "0" : "") + (date.getMonth() + 1) + "/" + date.getFullYear();
    }
    return '<div class="active-list-expiry"><strong>' + esc(label) + "</strong></div>";
  }
  function page(body, showHeader, viewportClass) {
    if (N.stopPairing) N.stopPairing();
    if (N.stopLiveMiniPlayer) N.stopLiveMiniPlayer();
    clearTimeout(liveEpgTimer); liveEpgTimer = null; liveEpgToken += 1;
    if (liveEpgRequest && liveEpgRequest.abort) liveEpgRequest.abort();
    liveEpgRequest = null;
    getApp().innerHTML =
      (showHeader ? header() : "") +
      '<div class="viewport ' +
      (showHeader ? "" : "full-viewport") + " " + (viewportClass || "") +
      '"><div class="content">' +
      body +
      "</div></div>" + (viewportClass === "home-viewport" ? expirationBadge() : "");
    wireCommon();
  }
  function wireCommon() {
    getApp().querySelectorAll("[data-route]").forEach(function (b) {
      b.onclick = function () {
        go(this.dataset.route);
      };
    });
    clock();
  }
  function clock() {
    clearInterval(N.clockTimer);
    var e = document.getElementById("clock");
    if (!e) return;
    function pad(value) { return value < 10 ? "0" + value : String(value); }
    function updateClock() {
      var now = new Date();
      e.textContent = pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + String(now.getFullYear()).slice(-2) + "  " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    }
    updateClock();
    N.clockTimer = setInterval(updateClock, 30000);
  }
  function go(route) {
    N.focusHistory.pushRoute();
    var target = "#/" + route;
    if (location.hash === target) N.render();
    else location.hash = target;
  }
  N.shortcutRoute = go;
  function shortcutLegend() {
    var colors = ["red", "green", "yellow", "blue"], names = { red: "Vermelho", green: "Verde", yellow: "Amarelo", blue: "Azul" };
    return '<div class="home-shortcuts" aria-label="Atalhos do controle">' + colors.map(function (color) {
      return '<span><i class="remote-color remote-' + color + '"></i><b>' + names[color] + '</b> ' + esc(N.shortcutAction(color).label) + '</span>';
    }).join("") + "</div>";
  }
  function shortcutConfigMarkup() {
    return ["red", "green", "yellow", "blue"].map(function (color) {
      var action = N.shortcutAction(color);
      return '<button class="shortcut-choice" data-shortcut-color="' + color + '"><i class="remote-color remote-' + color + '"></i><span><small>' + color.toUpperCase() + '</small><strong>' + esc(action.label) + '</strong></span></button>';
    }).join("");
  }
  function restore() {
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (!N.focusHistory.restore()) N.focus(N.focusables()[0]);
    }); });
  }
  N.back = function () {
    if (N.closeModal && N.closeModal(false)) return;
    if (N.closeKeyboard && N.closeKeyboard(true)) return;
    if (N.playerActive) {
      N.closePlayer();
      return;
    }
    var route = location.hash.replace("#/", "");
    if (route === "home") {
      try {
        if (typeof tizen !== "undefined")
          tizen.application.getCurrentApplication().exit();
      } catch (e) {}
      return;
    }
    N.focusHistory.capture();
    N.focusHistory.popRoute();
    history.back();
  };
  function login(edit) {
    var defaults = edit
      ? { name: edit.name, baseUrl: edit.baseUrl, username: edit.username, password: edit.password }
      : { name: "UltraCDN SBS", baseUrl: "http://ultracdn.sbs", username: "707407823", password: "481977783" };
    getApp().innerHTML =
      '<div class="viewport"><div class="content"><div class="panel form"><div class="eyebrow">Cinema Noir</div><h1>' +
      (edit ? "Editar lista" : "Adicionar sua lista Xtream") +
      '</h1><p>Os dados ficam armazenados somente nesta TV.</p><label class="field"><span>Nome da lista</span><input id="name" value="' +
      esc(defaults.name) +
      '"></label><label class="field"><span>URL do servidor</span><input id="url" placeholder="http://servidor:porta" value="' +
      esc(defaults.baseUrl) +
      '"></label><label class="field"><span>Usuário</span><input id="username" value="' +
      esc(defaults.username) +
      '"></label><label class="field"><span>Senha</span><input id="password" type="password" value="' +
      esc(defaults.password) +
      '"></label><div class="row"><button id="save">Testar e salvar</button>' +
      (N.profiles.length
        ? '<button data-route="settings">Cancelar</button>'
        : "") +
      '</div><p id="login-error" class="error"></p></div>' + (!edit && N.pairingMarkup ? N.pairingMarkup() : "") + '</div></div>';
    wireCommon();
    getApp().querySelectorAll("input").forEach(function (i) {
      i.readOnly = true;
      i.onclick = function () {
        N.openKeyboard(i);
      };
    });
    document.getElementById("save").onclick = function () {
      saveProfile(edit);
    };
    if (!edit && N.startPairing) N.startPairing();
    restore();
  }
  function saveProfile(old) {
    var name = document.getElementById("name").value.trim(),
      base = "http://" + document.getElementById("url").value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
      user = document.getElementById("username").value.trim(),
      pass = document.getElementById("password").value;
    if (!name || !base || !user || !pass)
      return showError("Preencha todos os campos.");
    if (!/^http:\/\/[^/\s]+/i.test(base))
      return showError("Informe o endereço correto do servidor.");
    var now = new Date().toISOString(),
      p = {
        id: old ? old.id : "p" + Date.now(),
        name: name,
        baseUrl: base,
        username: user,
        password: pass,
        createdAt: old ? old.createdAt : now,
        lastUsedAt: now,
      };
    showError("Testando conexão…");
    N.authenticate(p)
      .then(function () {
        var index = N.profiles.findIndex(function (x) {
          return x.id === p.id;
        });
        if (index >= 0) N.profiles[index] = p;
        else N.profiles.push(p);
        N.write("profiles", N.profiles);
        N.activate(p.id);
        go("home");
        N.render();
      })
      .catch(function (e) {
        if (e.message !== "cancelled") showError(e.message);
      });
  }
  function showError(msg) {
    document.getElementById("login-error").textContent = msg;
  }
  function home() {
    page(
      '<div class="home-page"><div class="home-intro"><div class="eyebrow">Sua central de entretenimento</div><h1>O que você quer assistir?</h1><p>' +
        esc(N.active.name) +
        '</p></div><div class="home-actions home-primary-actions" style="display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;flex-wrap:nowrap"><button id="home-live" class="home-card home-action-card" data-route="live" data-nav-left="home-live" data-nav-right="home-movies" data-nav-up="home-live" data-nav-down="home-continue">'+icon("tv")+'<span><strong>TV ao vivo</strong><small data-count="live">Carregando…</small></span></button><button id="home-movies" class="home-card home-action-card" data-route="movies" data-nav-left="home-live" data-nav-right="home-series" data-nav-up="home-movies" data-nav-down="home-search">'+icon("film")+'<span><strong>Filmes</strong><small data-count="movies">Carregando…</small></span></button><button id="home-series" class="home-card home-action-card" data-route="series" data-nav-left="home-movies" data-nav-right="home-series" data-nav-up="home-series" data-nav-down="home-settings">'+icon("clapperboard")+'<span><strong>Séries</strong><small data-count="series">Carregando…</small></span></button></div><div class="home-actions home-secondary-actions" style="display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;flex-wrap:nowrap"><button id="home-continue" class="home-card home-action-card home-compact-card" data-route="continue" data-nav-up="home-live" data-nav-left="home-continue" data-nav-right="home-search" data-nav-down="home-continue">'+icon("clock")+'<span><strong>Continuar</strong></span></button><button id="home-search" class="home-card home-action-card home-compact-card" data-route="search" data-nav-up="home-movies" data-nav-left="home-continue" data-nav-right="home-settings" data-nav-down="home-search">'+icon("search")+'<span><strong>Pesquisar</strong></span></button><button id="home-settings" class="home-card home-action-card home-compact-card" data-route="settings" data-nav-up="home-series" data-nav-left="home-search" data-nav-right="home-settings" data-nav-down="home-settings">'+icon("settings")+'<span><strong>Configurações</strong></span></button></div>' + (N.pairingMarkup ? N.pairingMarkup() : "") + shortcutLegend() + '</div>',
      true,
      "home-viewport",
    );
    if (N.startPairing) N.startPairing();
    ["live", "movies", "series"].forEach(function (k) {
      N.catalog(k)
        .then(function (d) {
          var el = document.querySelector('[data-count="' + k + '"]');
          if (el) el.textContent = d.length + " itens";
        })
        .catch(function (e) {
          var el = document.querySelector('[data-count="' + k + '"]');
          if (el) el.textContent = "Não disponível";
        });
    });
    restore();
  }
  function catalog(kind) {
    var names = { live: "TV ao vivo", movies: "Filmes", series: "Séries" }, state = N.focusHistory.get(kind);
    page(
      '<div class="catalog-page"><div class="section-head"><h1>' +
        names[kind] +
        '</h1><input id="filter" data-focusable="true" data-nav-down="CATEGORY_ALL" placeholder="Pesquisar em ' +
        names[kind].toLowerCase() +
        '"></div><div class="catalog-layout ' + (kind === "live" ? "live-layout" : "") + '"><aside class="category-scroll"><div id="categories" class="category-list" data-region="categories"><div class="skeleton"></div></div></aside><section class="grid-scroll"><div id="catalog" class="media-grid" data-region="' + (kind === "live" ? "channels" : kind + "-grid") + '"><div class="skeleton-grid"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div></div></section>' + (kind === "live" ? '<aside id="live-preview" class="live-preview"><div id="live-mini-stage" class="live-mini-stage"><img id="live-mini-logo" src="assets/fallback.svg" alt=""><span id="live-mini-status">Preparando prévia…</span></div><small id="live-playing-title" class="live-playing-title">Mini player</small><h2 id="live-selected-name">Selecione um canal</h2><div class="epg-heading">Programação</div><div id="live-epg" class="live-epg"><div class="epg-empty">Selecione um canal para ver o EPG.</div></div><p class="live-preview-hint">Navegue sem interromper o canal · OK abre em tela cheia</p></aside>' : '') + '</div></div>',
      false,
      "catalog-viewport",
    );
    Promise.all([N.catalog(kind), N.categories(kind)])
      .then(function (results) {
        currentItems = results[0];
        if (N.prepareCatalogSearchIndex) N.prepareCatalogSearchIndex(currentItems);
        var categories = [
          { category_id: "", category_name: "Todos" },
          {
            category_id: "__favorites",
            category_name: "Favoritos",
            icon: "star",
          },
        ];
        if (kind !== "live")
          categories.push({
            category_id: "__continue",
            category_name: "Continuar assistindo",
            icon: "clock",
          });
        categories = categories.concat(results[1]);
        var activeCategory = state.selectedCategoryId !== undefined ? String(state.selectedCategoryId) : "";
        var aside = document.getElementById("categories");
        aside.dataset.restoreY = Number(state.categoryOffsetY || 0);
        document.getElementById("catalog").dataset.restoreY = Number(kind === "live" ? state.channelOffsetY || 0 : state.offsetY || 0);
        aside.innerHTML = categories
          .map(function (c, n) {
            return (
              '<button class="category-item" id="CATEGORY_' +
              esc(c.category_id || "ALL") +
              '" data-value="' +
              esc(c.category_id) +
              '">' +
              (c.icon ? icon(c.icon) : "") +
              esc(c.category_name) +
              "</button>"
            );
          })
          .join("");
        document.getElementById("CATEGORY_ALL").setAttribute("data-nav-up", "filter");
        function update() {
          N.focusHistory.patch(kind, { selectedCategoryId: activeCategory, query: document.getElementById("filter").value });
          aside.querySelectorAll("button").forEach(function (b) {
            b.dataset.selected = String(b.dataset.value === activeCategory);
          });
          drawCatalog(
            kind,
            currentItems,
            document.getElementById("filter").value,
            activeCategory,
          );
          var firstCard = document.querySelector("#catalog .poster");
          var selectedButton = aside.querySelector('[data-selected="true"]');
          if (firstCard && selectedButton) {
            firstCard.setAttribute("data-nav-left", selectedButton.id);
            selectedButton.setAttribute("data-nav-right", firstCard.id);
          }
        }
        categories.forEach(function (c) {
          document.getElementById(
            "CATEGORY_" + (c.category_id || "ALL"),
          ).onclick = function () {
            var grid = document.getElementById("catalog"), filterField = document.getElementById("filter"),
              hadQuery = !!normalize(filterField.value), memory = N.focusHistory.get(kind).categoryPositions || {};
            clearTimeout(searchTimer);
            if (!hadQuery) memory[activeCategory] = { index: Number(grid.dataset.lastIndex || 0), scrollY: Number(grid.dataset.offsetY || 0), limit: Number(grid.dataset.limit || 40) };
            N.focusHistory.patch(kind, { categoryPositions: memory });
            filterField.value = "";
            activeCategory = String(c.category_id);
            var position = hadQuery ? { index: 0, scrollY: 0, limit: 40 } : memory[activeCategory] || { index: 0, scrollY: 0, limit: 40 };
            grid.dataset.limit = position.limit; grid.dataset.offsetY = position.scrollY; grid._scroller = null;
            N.focusHistory.patch(kind, { itemIndex: position.index, query: "" });
            update();
            var cards = grid.querySelectorAll(".poster");
            if (grid._focusVirtualIndex) { N.getGridScroller(grid).setY(position.scrollY); grid._focusVirtualIndex(position.index); }
            else if (cards.length) { N.getGridScroller(grid).setY(position.scrollY); N.focus(cards[Math.min(position.index, cards.length - 1)]); }
            else N.focus(this);
          };
        });
        var filter = document.getElementById("filter"),
          searchTimer;
        filter.value = state.query || "";
        filter.readOnly = true;
        filter.setAttribute("data-search-input", "true");
        filter.onclick = function () {
          N.openKeyboard(this);
        };
        filter.oninput = function () {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(update, 240);
        };
        update();
        if (kind === "live" && currentItems.length) {
          var initialLiveId = String(state.selectedChannelId || state.focusedChannelId || ""), initialLive = currentItems.filter(function (item) { return N.contentId(item) === initialLiveId; })[0] || currentItems[0];
          showLiveSelection(initialLive);
          if (N.queueLiveMiniPlayer) N.queueLiveMiniPlayer(initialLive, 420);
        }
        wireCommon();
        restore();
      })
      .catch(function (e) {
        if (e.message !== "cancelled") showLoadError("catalog", e.message);
      });
  }
  function savedProgress(kind, item) {
    if (kind === "movies") { var movie = N.WatchProgressStore.getMovieProgress(N.contentId(item)); return N.WatchProgressStore.isResumable(movie) ? movie : null; }
    if (kind === "series") return N.WatchProgressStore.getSeriesResume(N.contentId(item));
    return null;
  }
  function catalogLookup(kind) {
    var progress = {}, favorites = N.getFavorites ? N.getFavorites() : N.read(N.key("favorites"), {}), records, n, record, id;
    if (kind === "movies") {
      records = N.WatchProgressStore.getContinueWatchingMovies();
      for (n = 0; n < records.length; n++) {
        record = records[n];
        id = String(record.movieId || (record.item && N.contentId(record.item)) || "");
        if (id) progress[id] = record;
      }
    } else if (kind === "series") {
      records = N.WatchProgressStore.getContinueWatchingSeries();
      for (n = 0; n < records.length; n++) {
        record = records[n];
        id = String(record.seriesId || (record.item && record.item.series_id) || "");
        if (id) progress[id] = record;
      }
    }
    return { favorites: favorites, progress: progress };
  }
  function drawCatalog(kind, items, query, category) {
    var q = normalize(query), lookup = catalogLookup(kind),
      all = items.filter(function (i) {
        var match = !q || (N.catalogSearchText ? N.catalogSearchText(i) : normalize(i.name || i.title)).indexOf(q) >= 0;
        if (q) return match;
        if (category === "__favorites") return !!lookup.favorites[kind + ":" + N.contentId(i)];
        if (category === "__continue") return !!lookup.progress[N.contentId(i)];
        return match && (!category || String(i.category_id) === category);
      }),
      root = document.getElementById("catalog"),
      signature = kind + "|" + category + "|" + q,
      previousSignature = root.dataset.signature,
      initialIndex = previousSignature === signature ? Number(root.dataset.lastIndex || 0) : Number(N.focusHistory.get(kind).itemIndex || 0),
      columns = kind === "live" ? 1 : window.innerWidth >= 2300 ? 8 : window.innerWidth >= 1400 ? 7 : 6,
      rowHeight = kind === "live" ? 112 : window.innerWidth < 1400 || window.innerHeight < 800 ? 266 : 346,
      windowRows = kind === "live" ? 15 : 9,
      beforeRows = kind === "live" ? 6 : 4;
    root._renderVersion = Number(root._renderVersion || 0) + 1;
    function catalogItemId(item) {
      return (kind === "series" ? "SERIES_" : kind === "live" ? "CHANNEL_" : "MOVIE_") + N.contentId(item);
    }
    function catalogCard(i, n) {
      var saved = lookup.progress[N.contentId(i)] || null,
        titleText = String(i.name || i.title || "Sem título") + (kind === "series" && saved ? " · S" + (saved.seasonNumber || saved.item && saved.item.season || "") + ":E" + (saved.episodeNumber || saved.item && saved.item.episode_num || "") : ""),
        titleHtml = esc(titleText),
        marqueeClass = titleText.length > 19 ? "title-marquee is-overflowing" : "title-marquee",
        percent = saved && saved.duration ? Math.min(100, Math.round((saved.position / saved.duration) * 100)) : 0;
      return '<button class="poster" data-index="' + n + '" id="' + catalogItemId(i) + '"><img class="progressive-image" loading="lazy" decoding="async" src="assets/fallback.svg" data-src="' +
        esc(i.stream_icon || i.cover || "assets/fallback.svg") +
        '"><span class="label"><span class="' + marqueeClass + '"><span class="title-copy">' +
        titleHtml + '</span><span class="title-copy title-copy-clone" aria-hidden="true">' + titleHtml + "</span></span></span>" +
        (percent ? '<span class="card-progress"><i style="width:' + percent + '%"></i></span>' : "") +
        (lookup.favorites[kind + ":" + N.contentId(i)] ? '<span class="star" aria-label="Favorito">' + icon("star") + "</span>" : "") + "</button>";
    }
    root.dataset.signature = signature;
    root.dataset.limit = all.length;
    root.className = "media-grid";
    root._scroller = null;
    root.dataset.region = kind === "live" ? "channels" : kind + "-grid";
    function onCatalogClick() {
      var item = this._catalogItem;
      N.focusHistory.capture(kind);
      if (kind === "live") N.focusHistory.patch(kind, { selectedChannelId: N.contentId(item), focusedChannelId: N.contentId(item) });
      open(kind, item);
    }
    function onCatalogFocus() {
      var item = this._catalogItem, focusedIndex = Number(this.dataset.index);
      root.dataset.lastIndex = this.dataset.index;
      if (kind === "live") {
        N.focusHistory.patch(kind, { focusedChannelId: N.contentId(item), channelIndex: focusedIndex });
        showLiveSelection(item);
        if (N.queueLiveMiniPlayer) N.queueLiveMiniPlayer(item, 520);
      }
    }
    function onCatalogFavorite() {
      var item = this._catalogItem, focusedIndex = Number(this.dataset.index || 0);
      N.favorite(kind, item);
      N.toast(N.isFavorite(kind, item) ? "★ Adicionado aos favoritos" : "Removido dos favoritos");
      drawCatalog(kind, items, query, category);
      if (root._focusVirtualIndex) root._focusVirtualIndex(focusedIndex);
    }
    function wireCatalogItems(batch, startIndex) {
      batch.forEach(function (item, relativeIndex) {
        var id = catalogItemId(item), b = document.getElementById(id);
        if (!b) return;
        b.dataset.index = String(startIndex + relativeIndex);
        b._catalogItem = item; b.onclick = onCatalogClick; b.onfocus = onCatalogFocus; b._favorite = onCatalogFavorite;
      });
    }
    function renderWindow(centerIndex) {
      var totalRows = Math.ceil(all.length / columns), centerRow, startRow, endRow, start, end, batch, remainingRows;
      centerIndex = Math.max(0, Math.min(Math.max(0, all.length - 1), Number(centerIndex) || 0));
      centerRow = Math.floor(centerIndex / columns);
      startRow = Math.max(0, Math.min(Math.max(0, totalRows - windowRows), centerRow - beforeRows));
      endRow = Math.min(totalRows, startRow + windowRows);
      start = startRow * columns; end = Math.min(all.length, endRow * columns); batch = all.slice(start, end);
      remainingRows = Math.max(0, totalRows - endRow);
      root.style.setProperty("--virtual-top", (startRow ? startRow * rowHeight : 2) + "px");
      root.style.setProperty("--virtual-bottom", (remainingRows ? remainingRows * rowHeight : kind === "live" ? 40 : 44) + "px");
      root.innerHTML = batch.map(function (item, offset) { return catalogCard(item, start + offset); }).join("") || '<div class="empty">Nenhum conteúdo encontrado.</div>';
      root._virtualStart = start; root._virtualEnd = end; root._focusItems = null; root._focusChildCount = -1; root._scroller = null;
      wireCatalogItems(batch, start);
      if (N.loadImages) N.loadImages(root);
    }
    root._virtualTotal = all.length; root._virtualColumns = columns;
    root._focusVirtualIndex = function (index) {
      if (!all.length) return false;
      index = Math.max(0, Math.min(all.length - 1, Number(index) || 0));
      if (index < root._virtualStart || index >= root._virtualEnd) renderWindow(index);
      var target = root.querySelector('.poster[data-index="' + index + '"]'), scroller;
      if (!target) return false;
      scroller = N.getGridScroller(root); if (scroller) { scroller.totalItems = all.length; scroller.refresh(all.length); }
      return N.focus(target);
    };
    renderWindow(initialIndex);
  }
  function open(kind, item) {
    if (kind === "live") {
      N.openPlayer("live", item, item.name || "TV ao vivo");
      return;
    }
    N.detailItem = item;
    go(
      (kind === "series" ? "series-detail/" : "movie-detail/") +
        N.contentId(item),
    );
  }
  function findItem(kind, id) {
    var cached = N.cache[N.key("cache", kind)];
    if (!cached) return N.detailItem;
    return (
      cached.data.filter(function (i) {
        return N.contentId(i) === String(id);
      })[0] || N.detailItem
    );
  }
  function movieDetail(item) {
    if (!item) {
      N.back();
      return;
    }
    page(
      '<div class="movie-cinema-shell"><div id="movie-backdrop" class="movie-backdrop"></div><div class="movie-cinema-shade"></div><div class="movie-detail-toolbar"><button id="detail-back">' +
        icon("arrow-left") +
        ' Voltar</button></div><div id="details" class="status movie-loading">Carregando detalhes…</div></div>',
      false,
      "movie-detail-viewport",
    );
    document.getElementById("detail-back").onclick = N.back;
    N.request(N.active, "get_vod_info", { vod_id: N.contentId(item) })
      .then(function (info) {
        var data = info.info || {},
          saved = N.WatchProgressStore.getMovieProgress(N.contentId(item)),
          valid = N.WatchProgressStore.isResumable(saved), backdrop = data.backdrop_path,
          cover = item.stream_icon || data.movie_image || "assets/fallback.svg",
          title = data.name || item.name || "Filme", year = String(data.release_date || data.releasedate || item.added || "").match(/\d{4}/),
          duration = data.duration || "", classification = data.age || data.mpaa_rating || data.parental_rating || "",
          rating = data.rating || item.rating || "", quality = data.quality || item.quality || "",
          genres = String(data.genre || item.genre || "").split(/[,/]/).map(function (genre) { return genre.trim(); }).filter(Boolean).slice(0, 3),
          badges = [];
        if (year && title.indexOf(year[0]) >= 0) year = null;
        if (typeof backdrop === "string" && backdrop.charAt(0) === "[") {
          try { backdrop = JSON.parse(backdrop)[0]; } catch (ignoreMovieBackdropJson) {}
        }
        if (Array.isArray(backdrop)) backdrop = backdrop[0];
        if (!backdrop) backdrop = data.movie_image || cover;
        var backdropElement = document.getElementById("movie-backdrop");
        if (backdropElement) backdropElement.style.backgroundImage = 'url("' + String(backdrop).replace(/["\\]/g, "") + '")';
        if (classification) badges.push('<span class="classification-badge">' + esc(classification) + "</span>");
        if (year) badges.push("<span>" + esc(year[0]) + "</span>");
        if (duration) badges.push("<span>" + esc(duration) + "</span>");
        genres.forEach(function (genre) { badges.push("<span>" + esc(genre) + "</span>"); });
        if (quality) badges.push('<span class="quality-badge">' + esc(String(quality).toUpperCase()) + "</span>");
        if (rating) badges.push('<span class="movie-rating">★ ' + esc(rating) + "</span>");
        document.getElementById("details").className = "";
        document.getElementById("details").innerHTML =
          '<div class="movie-detail-page"><aside class="movie-cover-column"><img class="movie-cover" src="' + esc(cover) +
          '" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'"></aside><section class="movie-detail-content"><div class="movie-heading"><div class="eyebrow">Filme</div><h1>' + esc(title) +
          '</h1><div class="movie-badges">' + badges.join("") + '</div><p class="movie-synopsis">' + esc(data.plot || "Sem sinopse disponível.") +
          '</p><div class="movie-credits">' + (data.director ? '<p><b>Direção:</b> ' + esc(data.director) + "</p>" : "") +
          ((data.cast || data.actors) ? '<p><b>Elenco:</b> ' + esc(data.cast || data.actors) + "</p>" : "") +
          '</div><div class="movie-actions"><button id="movie-play" class="primary">' +
          icon("play") +
          (valid ? " Continuar " + formatTime(saved.position) : " Assistir") +
          "</button>" +
          (valid
            ? '<button id="movie-restart">' +
              icon("rotate-ccw") +
              " Recomeçar</button>"
            : "") +
          '<button id="movie-favorite">' + icon("heart") + '<span></span></button></div></div></section></div>';
        var play = document.getElementById("movie-play"), favorite = document.getElementById("movie-favorite");
        function updateFavoriteButton() {
          var active = N.isFavorite("movies", item);
          favorite.dataset.selected = String(active);
          favorite.classList.toggle("favorite-active", active);
          favorite.querySelector("span").textContent = active ? "Favoritado" : "Favoritar";
        }
        function toggleMovieFavorite() {
          var active = N.favorite("movies", item);
          updateFavoriteButton();
          N.toast(active ? "★ Adicionado aos favoritos" : "Removido dos favoritos");
        }
        play.onclick = function () {
          N.openPlayer("movies", item, title);
        };
        favorite.onclick = toggleMovieFavorite;
        play._favorite = favorite._favorite = toggleMovieFavorite;
        var restart = document.getElementById("movie-restart");
        if (restart) {
          restart._favorite = toggleMovieFavorite;
          restart.onclick = function () {
            localStorage.removeItem("noir:" + N.key("progress", "movies:" + N.contentId(item)));
            N.openPlayer("movies", item, title);
          };
        }
        updateFavoriteButton();
        wireCommon();
        requestAnimationFrame(function () { N.focus(play); });
      })
      .catch(function (e) {
        showLoadError("details", e.message);
      });
    restore();
  }
  function latestSeriesProgress(item) {
    return N.WatchProgressStore.getSeriesResume(N.contentId(item));
  }
  function seriesDetail(item) {
    if (!item) {
      N.back();
      return;
    }
    page(
      '<div class="series-cinema-shell"><div id="series-backdrop" class="series-backdrop"></div><div class="series-cinema-shade"></div><div class="series-detail-toolbar"><button id="series-back">' +
        icon("arrow-left") +
        ' Voltar</button></div><div id="details" class="status series-loading">Carregando episódios…</div></div>',
      false,
      "series-detail-viewport",
    );
    document.getElementById("series-back").onclick = N.back;
    N.request(N.active, "get_series_info", { series_id: N.contentId(item) })
      .then(function (info) {
        var seasons = info.episodes || {}, details = info.info || {},
          keys = Object.keys(seasons).sort(function (a, b) { return Number(a) - Number(b); }),
          latest = latestSeriesProgress(item),
          selected = keys[0] || "1",
          root = document.getElementById("details"), backdrop = details.backdrop_path, cover = item.cover || details.cover || "assets/fallback.svg",
          episodeCount = keys.reduce(function (total, key) { return total + (seasons[key] || []).length; }, 0),
          genres = String(details.genre || item.genre || "").split(/[,/]/).map(function (genre) { return genre.trim(); }).filter(Boolean).slice(0, 4),
          year = String(details.releaseDate || details.release_date || item.releaseDate || "").match(/\d{4}/), rating = details.rating || details.rating_5based || item.rating || "";
        if (year && String(item.name || "").indexOf(year[0]) >= 0) year = null;
        if (typeof backdrop === "string" && backdrop.charAt(0) === "[") {
          try { backdrop = JSON.parse(backdrop)[0]; } catch (ignoreBackdropJson) {}
        }
        if (Array.isArray(backdrop)) backdrop = backdrop[0];
        if (!backdrop) backdrop = cover;
        var backdropElement = document.getElementById("series-backdrop");
        if (backdropElement) backdropElement.style.backgroundImage = 'url("' + String(backdrop).replace(/["\\]/g, "") + '")';
        root.className = "";
        root.innerHTML =
          '<div class="series-detail-page"><aside class="series-cover-column"><img class="series-cover" src="' + esc(cover) +
          '" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'"></aside><section class="series-detail-content"><div class="series-heading"><div class="eyebrow">Série</div><h1>' +
          esc(item.name) + (year ? ' <small>(' + esc(year[0]) + ")</small>" : "") +
          '</h1><div class="series-badges">' + (rating ? '<span class="rating-badge">★ ' + esc(rating) + "</span>" : "") +
          '<span>' + keys.length + (keys.length === 1 ? " temporada" : " temporadas") + '</span><span>' + episodeCount + (episodeCount === 1 ? " episódio" : " episódios") + "</span>" +
          genres.map(function (genre) { return "<span>" + esc(genre) + "</span>"; }).join("") +
          '</div><p class="series-synopsis">' + esc(details.plot || "Sem sinopse disponível.") +
          '</p><div id="series-actions" class="series-summary-actions"></div></div><div class="series-season-line"><div class="season-scroll"><div id="seasons" class="season-list" data-region="seasons" data-focus-row></div></div><i></i></div><div class="episode-scroll"><div id="episodes" class="episode-grid" data-region="episodes"></div></div></section></div>';
        N.focusHistory.patch("series-detail", { seriesId: N.contentId(item), selectedSeason: selected });
        var actions = document.getElementById("series-actions");
        if (latest) {
          actions.innerHTML =
            '<button id="series-continue" class="primary">' +
            icon("play") +
            " Continuar S" +
            esc(latest.seasonNumber || latest.item && latest.item.season || "") +
            ":E" +
            esc(latest.episodeNumber || latest.item && latest.item.episode_num || "") +
            '</button><button id="series-restart">' +
            icon("rotate-ccw") +
            " Voltar ao início</button>";
          document.getElementById("series-continue").onclick = function () {
            N.openPlayer("episode", latest.item, latest.title || item.name, buildEpisodeOptions(item, seasons, latest.item, latest.seasonNumber || latest.item.season));
          };
          document.getElementById("series-restart").onclick = function () {
            selected = keys[0];
            renderSeasons();
            focusFirstEpisode();
          };
        }
        function renderSeasons() {
          var bar = document.getElementById("seasons");
          bar.innerHTML = keys
            .map(function (s) {
              return (
                '<button id="SEASON_' +
                esc(s) +
                '" class="season-button" data-selected="' +
                String(s === selected) +
                '">Temporada ' +
                esc(s) +
                "</button>"
              );
            })
            .join("");
          keys.forEach(function (s) {
            document.getElementById("SEASON_" + s).onclick = function () {
              selected = s;
              N.focusHistory.patch("series-detail", { seriesId: N.contentId(item), selectedSeason: selected, focusedSeason: s, offsetY: 0 });
              renderSeasons();
              N.focus(document.getElementById("SEASON_" + s));
            };
          });
          renderEpisodes();
        }
        function renderEpisodes() {
          var list = seasons[selected] || [],
            out = document.getElementById("episodes");
          out.dataset.offsetY = "0";
          out.style.transform = "translate3d(0px,0px,0px)";
          out._scroller = null;
          out.innerHTML =
            list
              .map(function (ep, n) {
                var saved = N.WatchProgressStore.getEpisodeProgress(N.contentId(ep)),
                  episodeInfo = ep.info || {},
                  pct =
                    saved && saved.duration
                      ? Math.round((saved.position / saved.duration) * 100)
                      : 0,
                  thumb = episodeInfo.movie_image || episodeInfo.cover_big || ep.movie_image || cover,
                  description = episodeInfo.plot || ep.plot || "Sem descrição disponível.",
                  duration = episodeInfo.duration || ep.duration || "";
                if (!duration && Number(episodeInfo.duration_secs || ep.duration_secs)) duration = Math.max(1, Math.round(Number(episodeInfo.duration_secs || ep.duration_secs) / 60)) + " min";
                return (
                  '<button class="episode" data-index="' + n + '" id="EPISODE_' +
                  N.contentId(ep) +
                  '"><img class="episode-thumb" loading="lazy" decoding="async" src="' + esc(thumb) + '" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'"><b class="episode-number">E' +
                  esc(ep.episode_num || n + 1) +
                  '</b><span class="episode-copy"><strong>' + esc(ep.title || "Episódio") + '</strong><small>' + esc(description) +
                  '</small></span><span class="episode-duration">' + esc(duration) + (pct ? '<small>' + pct + "% assistido</small>" : "") +
                  '</span><span class="episode-play">' + icon("play") + "</span>" +
                  (pct
                    ? '<i class="episode-progress" style="width:' +
                      pct +
                      '%"></i>'
                    : "") +
                  "</button>"
                );
              })
              .join("") ||
            '<div class="empty">Nenhum episódio nesta temporada.</div>';
          list.forEach(function (ep, n) {
            document.getElementById("EPISODE_" + N.contentId(ep)).onclick =
              function () {
                N.openPlayer("episode", ep, ep.title || item.name, buildEpisodeOptions(item, seasons, ep, selected));
              };
          });
        }
        function focusFirstEpisode() {
          var firstEpisode = document.querySelector("#episodes .episode");
          if (firstEpisode) N.focus(firstEpisode);
          else N.focus(document.getElementById("SEASON_" + selected));
        }
        renderSeasons();
        wireCommon();
        requestAnimationFrame(function () { requestAnimationFrame(focusFirstEpisode); });
      })
      .catch(function (e) {
        showLoadError("details", e.message);
      });
    restore();
  }
  function formatTime(value) {
    var s = Math.max(0, Math.floor(value || 0)),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      x = s % 60;
    return (
      (h ? h + ":" : "") +
      (h && m < 10 ? "0" : "") +
      m +
      ":" +
      (x < 10 ? "0" : "") +
      x
    );
  }
  function showLoadError(id, message) {
    var root = document.getElementById(id);
    if (!root) return;
    root.innerHTML =
      '<div class="error-state"><h2>Não foi possível carregar o conteúdo.</h2><p>' +
      esc(message) +
      '</p><div class="row"><button id="retry-load">Tentar novamente</button><button id="back-error">Voltar</button></div></div>';
    document.getElementById("retry-load").onclick = N.render;
    document.getElementById("back-error").onclick = N.back;
    N.focus(document.getElementById("retry-load"));
  }
  function settings() {
    var liveBufferSeconds = N.Settings.get("liveBufferSeconds"),
      vodBufferSeconds = N.Settings.get("vodBufferSeconds"), currentTheme = N.Settings.get("theme"), currentPerformance = N.Settings.get("performanceMode");
    var themeMarkup = N.ThemeCatalog.map(function (theme) {
      var colors = theme.colors;
      return '<button class="theme-choice" data-theme-choice="' + theme.id + '"><span class="theme-preview preview-' + theme.id + '" style="--preview-bg:' + colors.background + ';--preview-surface:' + colors.surface + ';--preview-primary:' + colors.primary + ';--preview-focus:' + colors.focus + '"><i></i><i></i><i></i></span><span class="theme-copy"><strong>' + theme.name + '</strong><small>' + theme.description + '</small></span></button>';
    }).join("");
    page(
      '<div class="settings-page"><div class="toolbar"><h1>Configurações</h1></div><div class="settings-columns"><div class="settings-lists"><div class="panel"><button id="add">' + icon("plus") + ' Adicionar lista</button><div id="profiles"></div><div class="shortcut-settings"><h2>Atalhos coloridos</h2><p>Pressione OK para trocar a função.</p><div class="shortcut-config-grid">' + shortcutConfigMarkup() + '</div></div></div></div><div class="settings-options"><div class="panel playback-settings"><h2>Buffer de reprodução</h2><div class="buffer-option"><h3>TV ao vivo</h3><p>O mínimo é 1 minuto e a mudança vale ao abrir o próximo canal.</p><div class="buffer-setting"><button id="buffer-minus" aria-label="Diminuir buffer da TV ao vivo">− 30s</button><strong id="live-buffer-value"></strong><button id="buffer-plus" aria-label="Aumentar buffer da TV ao vivo">+ 30s</button></div><small>Intervalo: 60 a 300 segundos.</small></div><div class="buffer-option"><h3>Filmes e séries</h3><p>Controla o buffer inicial e a recuperação após interrupções.</p><div class="buffer-setting"><button id="vod-buffer-minus" aria-label="Diminuir buffer de filmes e séries">− 5s</button><strong id="vod-buffer-value"></strong><button id="vod-buffer-plus" aria-label="Aumentar buffer de filmes e séries">+ 5s</button></div><small>Intervalo: 5 a 120 segundos.</small></div><div class="performance-setting"><h3>Desempenho da interface</h3><p>Automático usa o modo rápido na TV e mantém os efeitos completos no navegador.</p><div class="performance-choices"><button data-performance-choice="auto">Automático</button><button data-performance-choice="speed">Máxima fluidez</button><button data-performance-choice="quality">Visual completo</button></div></div><div class="update-setting"><span><b>Aplicativo v' + esc(N.APP_VERSION || "1.0.0") + '</b><small>Atualizações automáticas pela Samsung Apps TV.</small></span><button id="check-update">Verificar</button></div></div><div class="panel theme-settings"><div class="theme-heading"><span><h2>Temas</h2><p>Escolha com ↑ e ↓. A prévia é aplicada imediatamente.</p></span><strong id="theme-position"></strong></div><div class="theme-scroll"><div id="theme-track" class="theme-switch vertical-track" data-region="themes">' + themeMarkup + '</div></div><div class="theme-scroll-hint">↑ ↓ Navegar · OK Aplicar</div></div></div></div></div>',
      false,
      "settings-viewport",
    );
    function showBufferValue() {
      document.getElementById("live-buffer-value").textContent = liveBufferSeconds + " segundos";
      document.getElementById("vod-buffer-value").textContent = vodBufferSeconds + " segundos";
    }
    document.getElementById("buffer-minus").onclick = function () {
      liveBufferSeconds = N.Settings.set("liveBufferSeconds", liveBufferSeconds - 30);
      showBufferValue();
      N.toast("Buffer da TV ao vivo: " + liveBufferSeconds + " segundos.");
    };
    document.getElementById("buffer-plus").onclick = function () {
      liveBufferSeconds = N.Settings.set("liveBufferSeconds", liveBufferSeconds + 30);
      showBufferValue();
      N.toast("Buffer da TV ao vivo: " + liveBufferSeconds + " segundos.");
    };
    document.getElementById("vod-buffer-minus").onclick = function () {
      vodBufferSeconds = N.Settings.set("vodBufferSeconds", vodBufferSeconds - 5);
      showBufferValue();
      N.toast("Buffer de filmes e séries: " + vodBufferSeconds + " segundos.");
    };
    document.getElementById("vod-buffer-plus").onclick = function () {
      vodBufferSeconds = N.Settings.set("vodBufferSeconds", vodBufferSeconds + 5);
      showBufferValue();
      N.toast("Buffer de filmes e séries: " + vodBufferSeconds + " segundos.");
    };
    showBufferValue();
    function updatePerformanceButtons() {
      document.querySelectorAll("[data-performance-choice]").forEach(function (button) { button.dataset.selected = String(button.dataset.performanceChoice === currentPerformance); });
    }
    document.querySelectorAll("[data-performance-choice]").forEach(function (button) {
      button.onclick = function () {
        currentPerformance = N.Settings.set("performanceMode", this.dataset.performanceChoice);
        N.applyPerformanceMode(); updatePerformanceButtons(); N.focus(this);
        N.toast(currentPerformance === "speed" ? "Máxima fluidez ativada." : currentPerformance === "quality" ? "Visual completo ativado." : "Desempenho automático ativado.");
      };
    });
    updatePerformanceButtons();
    document.getElementById("check-update").onclick = function () { N.checkForUpdates(true); };
    document.querySelectorAll("[data-shortcut-color]").forEach(function (button) {
      button.onclick = function () {
        var color = this.dataset.shortcutColor, key = "shortcut" + color.charAt(0).toUpperCase() + color.slice(1), currentId = N.Settings.get(key), currentIndex = -1, i;
        for (i = 0; i < N.ShortcutActions.length; i += 1) if (N.ShortcutActions[i].id === currentId) { currentIndex = i; break; }
        var next = N.ShortcutActions[(currentIndex + 1) % N.ShortcutActions.length];
        N.Settings.set(key, next.id);
        this.querySelector("strong").textContent = next.label;
        N.toast(color.toUpperCase() + ": " + next.label);
        N.focus(this);
      };
    });
    function updateThemeButtons() {
      document.querySelectorAll("[data-theme-choice]").forEach(function (button) { button.dataset.selected = String(button.dataset.themeChoice === currentTheme); });
      var selected = document.querySelector('[data-theme-choice="' + currentTheme + '"]'), position = document.getElementById("theme-position");
      if (position && selected) position.textContent = (Array.prototype.indexOf.call(selected.parentElement.children, selected) + 1) + " / " + N.ThemeCatalog.length;
    }
    document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
      button.onfocus = function () {
        var position = document.getElementById("theme-position");
        if (position) position.textContent = (Array.prototype.indexOf.call(this.parentElement.children, this) + 1) + " / " + N.ThemeCatalog.length;
      };
      button.onclick = function () {
        currentTheme = N.Settings.set("theme", this.dataset.themeChoice);
        N.applyTheme();
        updateThemeButtons();
        N.focus(this);
      };
    });
    updateThemeButtons();
    document.getElementById("add").onclick = function () {
      login();
    };
    var root = document.getElementById("profiles");
    root.innerHTML = N.profiles
      .map(function (p, n) {
        return (
          '<div class="profile-row ' +
          (p.id === N.active.id ? "profile-active " : "") +
          (p.enabled === false ? "profile-disabled" : "") +
          '"><strong>' +
          esc(p.name) +
          (p.id === N.active.id ? " · ATIVA" : p.enabled === false ? " · DESATIVADA" : "") +
          "</strong><span>" +
          esc(p.baseUrl) +
          '</span><button id="activate-' +
          n +
          '"' + (p.enabled === false ? " disabled" : "") + '>' +
          icon("user") +
          ' Usar</button><button id="test-' +
          n +
          '">' +
          icon("circle-check") +
          ' Testar</button><button id="edit-' +
          n +
          '">' +
          icon("pencil") +
          ' Editar</button><button id="remove-' +
          n +
          '">' +
          icon("trash-2") +
          " Remover</button></div>"
        );
      })
      .join("");
    N.profiles.forEach(function (p, n) {
      document.getElementById("activate-" + n).onclick = function () {
        if (p.enabled === false) return;
        N.activate(p.id);
        N.toast("Lista ativa: " + p.name);
        N.render();
      };
      document.getElementById("test-" + n).onclick = function () {
        N.authenticate(p)
          .then(function () {
            N.write("profiles", N.profiles);
            N.toast("Conexão com " + p.name + " funcionando.");
          })
          .catch(function (e) {
            N.toast(e.message);
          });
      };
      document.getElementById("edit-" + n).onclick = function () {
        login(p);
      };
      document.getElementById("remove-" + n).onclick = function () {
        N.confirm(
          "Remover lista",
          "Remover " + p.name + " e deixar de exibi-la neste aplicativo?",
          function () {
            N.profiles.splice(n, 1);
            N.write("profiles", N.profiles);
            if (N.active.id === p.id) {
              N.active = N.profiles[0] || null;
              if (N.active) N.activate(N.active.id);
              else N.write("active", null);
            }
            N.render();
          },
        );
      };
    });
    wireCommon();
    restore();
  }
  function continuing() {
    var all = N.WatchProgressStore.getContinueWatchingMovies().concat(N.WatchProgressStore.getContinueWatchingSeries());
    all.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    page(
      '<div class="static-page"><div class="toolbar"><h1>Continuar assistindo</h1></div><div class="standalone-grid-viewport"><div id="continue-list" class="grid vertical-track" data-region="continue-grid"></div></div></div>',
    );
    var root = document.getElementById("continue-list");
    root.innerHTML =
      all
        .map(function (x, n) {
          return (
            '<button class="poster" id="continue-' +
            n +
            '"><img src="' +
            esc(x.seriesPoster || x.item && (x.item.stream_icon || x.item.cover) || "assets/fallback.svg") +
            '"><span class="label">' +
            esc(x.seriesName || x.title) + (x.kind === "episode" ? " · S" + esc(x.seasonNumber || x.item && x.item.season || "") + ":E" + esc(x.episodeNumber || x.item && x.item.episode_num || "") : "") + " · " +
            Math.round((x.position / Math.max(x.duration, 1)) * 100) +
            "%</span></button>"
          );
        })
        .join("") || '<div class="empty">Nada para continuar ainda.</div>';
    all.forEach(function (x, n) {
      var b = document.getElementById("continue-" + n);
      if (b)
        b.onclick = function () {
          if (x.kind === "episode") resumeEpisode(x);
          else N.openPlayer(x.kind, x.item, x.title, {});
        };
    });
    restore();
  }
  function search() {
    page(
      '<div class="static-page"><div class="toolbar"><h1>Pesquisar</h1></div><div class="panel search-panel"><input id="global-search" data-search-input="true" readonly placeholder="Pesquisar em filmes, séries e canais"><p>Escolha uma seção na tela inicial para filtrar também por categoria e favoritos.</p></div><div class="standalone-grid-viewport search-grid-viewport"><div id="search-results" class="grid vertical-track" data-region="search-grid"></div></div></div>',
    );
    var input = document.getElementById("global-search");
    input.readOnly = true;
    input.onclick = function () {
      N.openKeyboard(input);
    };
    input.oninput = function () {
      var q = normalize(input.value),
        items = [];
      ["live", "movies", "series"].forEach(function (k) {
        (N.cache[N.key("cache", k)] || { data: [] }).data.forEach(function (i) {
          if (
            normalize(i.name || "")
              .indexOf(q) >= 0
          )
            items.push({ kind: k, item: i });
        });
      });
      N.focusHistory.patch("search", { query: input.value });
      var root = document.getElementById("search-results");
      root.innerHTML = q
        ? items
            .slice(0, 120)
            .map(function (x, n) {
              return (
                '<button class="poster" id="result-' +
                n +
                '"><img src="' +
                esc(
                  x.item.stream_icon || x.item.cover || "assets/fallback.svg",
                ) +
                '"><span class="label">' +
                esc(x.item.name) +
                "</span></button>"
              );
            })
            .join("")
        : '<div class="empty">Digite para pesquisar nos catálogos já carregados.</div>';
      items.slice(0, 120).forEach(function (x, n) {
        var b = document.getElementById("result-" + n);
        if (b)
          b.onclick = function () {
            open(x.kind, x.item);
          };
      });
    };
    input.value = N.focusHistory.get("search").query || "";
    input.oninput();
    restore();
  }
  N.render = function () {
    if (!N.active) return login();
    var parts = location.hash.replace("#/", "").split("/"),
      route = parts[0] || "home";
    if (route === "home") home();
    else if (route === "settings") settings();
    else if (route === "continue") continuing();
    else if (route === "search") search();
    else if (route === "movie-detail")
      movieDetail(findItem("movies", parts[1]));
    else if (route === "series-detail")
      seriesDetail(findItem("series", parts[1]));
    else if (route === "live" || route === "movies" || route === "series")
      catalog(route);
    else go("home");
  };
  window.addEventListener("hashchange", function () {
    if (!N.playerActive) N.render();
  });
  setInterval(clock, 30000);
})(Noir);
