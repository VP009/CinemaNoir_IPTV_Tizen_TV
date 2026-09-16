(function (N) {
  "use strict";
  var app = null, currentItems = [];
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
  function header() {
    return '<header class="home-status-bar"><span id="clock"></span></header>';
  }
  function page(body, showHeader, viewportClass) {
    getApp().innerHTML =
      (showHeader ? header() : "") +
      '<div class="viewport ' +
      (showHeader ? "" : "full-viewport") + " " + (viewportClass || "") +
      '"><div class="content">' +
      body +
      "</div></div>";
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
      '</div><p id="login-error" class="error"></p></div></div></div>';
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
        '</p></div><div class="home-actions home-primary-actions" style="display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;flex-wrap:nowrap"><button id="home-live" class="home-card home-action-card" data-route="live" data-nav-left="home-live" data-nav-right="home-movies" data-nav-up="home-live" data-nav-down="home-continue">'+icon("tv")+'<span><strong>TV ao vivo</strong><small data-count="live">Carregando…</small></span></button><button id="home-movies" class="home-card home-action-card" data-route="movies" data-nav-left="home-live" data-nav-right="home-series" data-nav-up="home-movies" data-nav-down="home-search">'+icon("film")+'<span><strong>Filmes</strong><small data-count="movies">Carregando…</small></span></button><button id="home-series" class="home-card home-action-card" data-route="series" data-nav-left="home-movies" data-nav-right="home-series" data-nav-up="home-series" data-nav-down="home-settings">'+icon("clapperboard")+'<span><strong>Séries</strong><small data-count="series">Carregando…</small></span></button></div><div class="home-actions home-secondary-actions" style="display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;flex-wrap:nowrap"><button id="home-continue" class="home-card home-action-card home-compact-card" data-route="continue" data-nav-up="home-live" data-nav-left="home-continue" data-nav-right="home-search" data-nav-down="home-continue">'+icon("clock")+'<span><strong>Continuar</strong></span></button><button id="home-search" class="home-card home-action-card home-compact-card" data-route="search" data-nav-up="home-movies" data-nav-left="home-continue" data-nav-right="home-settings" data-nav-down="home-search">'+icon("search")+'<span><strong>Pesquisar</strong></span></button><button id="home-settings" class="home-card home-action-card home-compact-card" data-route="settings" data-nav-up="home-series" data-nav-left="home-search" data-nav-right="home-settings" data-nav-down="home-settings">'+icon("settings")+'<span><strong>Configurações</strong></span></button></div></div>',
      true,
      "home-viewport",
    );
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
        '"></div><div class="catalog-layout ' + (kind === "live" ? "live-layout" : "") + '"><aside class="category-scroll"><div id="categories" class="category-list" data-region="categories"><div class="skeleton"></div></div></aside><section class="grid-scroll"><div id="catalog" class="media-grid" data-region="' + (kind === "live" ? "channels" : kind + "-grid") + '"><div class="skeleton-grid"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div></div></section>' + (kind === "live" ? '<aside id="live-preview" class="live-preview">' + icon("tv") + '<h2>Selecione um canal</h2><p>O canal escolhido será reproduzido em tela cheia.</p></aside>' : '') + '</div></div>',
      false,
      "catalog-viewport",
    );
    Promise.all([N.catalog(kind), N.categories(kind)])
      .then(function (results) {
        currentItems = results[0];
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
            if (cards.length) { N.getGridScroller(grid).setY(position.scrollY); N.focus(cards[Math.min(position.index, cards.length - 1)]); }
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
  function drawCatalog(kind, items, query, category) {
    var q = normalize(query),
      all = items.filter(function (i) {
        var match = !q || normalize(i.name || i.title).indexOf(q) >= 0;
        if (category === "__favorites") return match && N.isFavorite(kind, i);
        if (category === "__continue") return match && !!savedProgress(kind, i);
        return match && (!category || String(i.category_id) === category);
      }),
      root = document.getElementById("catalog"),
      signature = kind + "|" + category + "|" + q,
      limit =
        root.dataset.signature === signature
          ? Number(root.dataset.limit || 40)
          : Math.max(40, Number(N.focusHistory.get(kind).itemIndex || 0) + 1),
      filtered = all.slice(0, limit);
    root.dataset.signature = signature;
    root.dataset.limit = limit;
    root.className = "media-grid";
    root._scroller = null;
    root.dataset.region = kind === "live" ? "channels" : kind + "-grid";
    root.innerHTML =
      filtered
        .map(function (i, n) {
          var saved = savedProgress(kind, i),
            titleText = String(i.name || i.title || "Sem título") + (kind === "series" && saved ? " · S" + (saved.seasonNumber || saved.item && saved.item.season || "") + ":E" + (saved.episodeNumber || saved.item && saved.item.episode_num || "") : ""),
            titleHtml = esc(titleText),
            marqueeClass = titleText.length > 19 ? "title-marquee is-overflowing" : "title-marquee",
            percent =
              saved && saved.duration
                ? Math.min(
                    100,
                    Math.round((saved.position / saved.duration) * 100),
                  )
                : 0;
          return (
            '<button class="poster" data-index="' + n + '" id="' +
            (kind === "series" ? "SERIES_" : kind === "live" ? "CHANNEL_" : "MOVIE_") +
            N.contentId(i) +
            '"><img loading="lazy" src="' +
            esc(i.stream_icon || i.cover || "assets/fallback.svg") +
            '" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'"><span class="label"><span class="' + marqueeClass + '"><span class="title-copy">' +
            titleHtml +
            '</span><span class="title-copy title-copy-clone" aria-hidden="true">' + titleHtml + "</span></span></span>" +
            (percent
              ? '<span class="card-progress"><i style="width:' +
                percent +
                '%"></i></span>'
              : "") +
            (N.isFavorite(kind, i)
            ? '<span class="star" aria-label="Favorito">' + icon("star") + "</span>"
              : "") +
            "</button>"
          );
        })
        .join("") || '<div class="empty">Nenhum conteúdo encontrado.</div>';
    filtered.forEach(function (item) {
      var id = (kind === "series" ? "SERIES_" : kind === "live" ? "CHANNEL_" : "MOVIE_") + N.contentId(item),
        b = document.getElementById(id);
      b.onclick = function () {
        N.focusHistory.capture(kind);
        if (kind === "live") N.focusHistory.patch(kind, { selectedChannelId: N.contentId(item), focusedChannelId: N.contentId(item) });
        open(kind, item);
      };
      b.onfocus = function () {
        root.dataset.lastIndex = this.dataset.index;
        if (kind === "live") {
          N.focusHistory.patch(kind, { focusedChannelId: N.contentId(item), channelIndex: Number(this.dataset.index) });
          var preview = document.getElementById("live-preview");
          if (preview) preview.innerHTML = '<img src="' + esc(item.stream_icon || "assets/fallback.svg") + '" onerror="this.src=\'assets/fallback.svg\'"><h2>' + esc(item.name || "Canal") + '</h2><p>Pressione OK para assistir.</p>';
        }
      };
      b._favorite = function () {
        N.favorite(kind, item);
        N.toast(
          N.isFavorite(kind, item)
            ? "★ Adicionado aos favoritos"
            : "Removido dos favoritos",
        );
        drawCatalog(kind, items, query, category);
        N.focus(document.getElementById(id));
      };
    });
    if (all.length > limit) {
      var more = document.createElement("button");
      more.id = "LOAD_MORE";
      more.className = "load-more";
      more.innerHTML =
        icon("plus") + " Carregar mais " + Math.min(40, all.length - limit);
      more.onclick = function () {
        var currentY = Number(root.dataset.offsetY || 0), anchorIndex = limit;
        root.dataset.limit = limit + 40;
        drawCatalog(kind, items, query, category);
        root.dataset.offsetY = String(currentY);
        root._scroller = null;
        setTimeout(function () {
          var cards = root.querySelectorAll(".poster"), anchor = cards[anchorIndex] || cards[cards.length - 1];
          if (anchor) N.focus(anchor);
          if (kind === "live") N.getGridScroller(root).setY(currentY);
          else N.setSeriesY(currentY);
        }, 20);
      };
      root.appendChild(more);
    }
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
      '<div class="toolbar"><button id="detail-back">' +
        icon("arrow-left") +
        ' Voltar</button></div><div id="details" class="status">Carregando detalhes…</div>',
    );
    document.getElementById("detail-back").onclick = N.back;
    N.request(N.active, "get_vod_info", { vod_id: N.contentId(item) })
      .then(function (info) {
        var data = info.info || {},
          saved = N.WatchProgressStore.getMovieProgress(N.contentId(item)),
          valid = N.WatchProgressStore.isResumable(saved);
        document.getElementById("details").className = "";
        document.getElementById("details").innerHTML =
          '<div class="detail detail-page"><img src="' +
          esc(data.movie_image || item.stream_icon || "assets/fallback.svg") +
          '" onerror="this.src=\'assets/fallback.svg\'"><section><div class="eyebrow">Filme</div><h1>' +
          esc(data.name || item.name) +
          "</h1><p>" +
          esc(data.plot || "Sem sinopse disponível.") +
          '</p><p class="meta">' +
          esc(data.genre || "") +
          " " +
          esc(data.release_date || "") +
          '</p><div class="row"><button id="movie-play" class="primary">' +
          icon("play") +
          (valid ? " Continuar " + formatTime(saved.position) : " Assistir") +
          "</button>" +
          (valid
            ? '<button id="movie-restart">' +
              icon("rotate-ccw") +
              " Recomeçar</button>"
            : "") +
          "</div></section></div>";
        document.getElementById("movie-play").onclick = function () {
          N.openPlayer("movies", item, item.name);
        };
        var restart = document.getElementById("movie-restart");
        if (restart)
          restart.onclick = function () {
            localStorage.removeItem("noir:" + N.key("progress", "movies:" + N.contentId(item)));
            N.openPlayer("movies", item, item.name);
          };
        wireCommon();
        requestAnimationFrame(function () { N.focus(document.getElementById("movie-play")); });
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
      '<div class="toolbar"><button id="series-back">' +
        icon("arrow-left") +
        ' Voltar</button></div><div id="details" class="status">Carregando episódios…</div>',
    );
    document.getElementById("series-back").onclick = N.back;
    N.request(N.active, "get_series_info", { series_id: N.contentId(item) })
      .then(function (info) {
        var seasons = info.episodes || {},
          keys = Object.keys(seasons).sort(function (a, b) { return Number(a) - Number(b); }),
          latest = latestSeriesProgress(item),
          selected = keys[0] || "1",
          root = document.getElementById("details");
        root.className = "";
        root.innerHTML =
          '<div class="detail detail-page series-detail-page"><img src="' +
          esc(
            (info.info && info.info.cover) ||
              item.cover ||
              "assets/fallback.svg",
          ) +
          '" onerror="this.src=\'assets/fallback.svg\'"><section><div class="eyebrow">Série</div><h1>' +
          esc(item.name) +
          "</h1><p>" +
          esc((info.info && info.info.plot) || "Sem sinopse disponível.") +
          '</p><div id="series-actions" class="row"></div><div class="season-scroll"><div id="seasons" class="season-list" data-region="seasons" data-focus-row></div></div><div class="episode-scroll"><div id="episodes" class="episode-grid" data-region="episodes"></div></div></section></div>';
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
            N.openPlayer("episode", latest.item, latest.title || item.name, { seriesId: N.contentId(item), seriesName: item.name, seriesPoster: item.cover });
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
                  pct =
                    saved && saved.duration
                      ? Math.round((saved.position / saved.duration) * 100)
                      : 0;
                return (
                  '<button class="episode" data-index="' + n + '" id="EPISODE_' +
                  N.contentId(ep) +
                  '"><span><b>E' +
                  esc(ep.episode_num) +
                  "</b> " +
                  esc(ep.title || "Episódio") +
                  "</span><span>" +
                  (pct ? pct + "%" : "") +
                  "</span>" +
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
          function buildEpisodeOptions(episode, seasonKey) {
            var seasonIndex = keys.indexOf(String(seasonKey)),
              listForSeason = seasons[String(seasonKey)] || [],
              episodeIndex = listForSeason.indexOf(episode),
              prev = episodeIndex > 0 ? listForSeason[episodeIndex - 1] : null,
              next = episodeIndex >= 0 && episodeIndex < listForSeason.length - 1 ? listForSeason[episodeIndex + 1] : null,
              prevSeasonKey = String(seasonKey), nextSeasonKey = String(seasonKey);
            if (!prev && seasonIndex > 0) {
              for (var previousIndex = seasonIndex - 1; previousIndex >= 0 && !prev; previousIndex -= 1) {
                var prevSeason = keys[previousIndex], prevList = seasons[prevSeason] || [];
                if (prevList.length) { prev = prevList[prevList.length - 1]; prevSeasonKey = String(prevSeason); }
              }
            }
            if (!next && seasonIndex < keys.length - 1) {
              for (var nextIndex = seasonIndex + 1; nextIndex < keys.length && !next; nextIndex += 1) {
                var nextSeason = keys[nextIndex];
                if (nextSeason && seasons[nextSeason] && seasons[nextSeason][0]) {
                  next = seasons[nextSeason][0];
                  nextSeasonKey = String(nextSeason);
                }
              }
            }
            return {
              seriesId: N.contentId(item),
              seriesName: item.name,
              seriesPoster: item.cover,
              seasonNumber: String(seasonKey),
              prevItem: prev,
              nextItem: next,
              nextSeasonNumber: next ? next.season || nextSeasonKey : null,
              prev: prev
                ? function () {
                    N.openPlayer(
                      "episode",
                      prev,
                      prev.title || item.name,
                      buildEpisodeOptions(prev, prev.season || prevSeasonKey),
                    );
                  }
                : null,
              next: next
                ? function () {
                    N.openPlayer(
                      "episode",
                      next,
                      next.title || item.name,
                      buildEpisodeOptions(next, next.season || nextSeasonKey),
                    );
                  }
                : null,
            };
          }
          list.forEach(function (ep, n) {
            document.getElementById("EPISODE_" + N.contentId(ep)).onclick =
              function () {
                N.openPlayer("episode", ep, ep.title || item.name, buildEpisodeOptions(ep, selected));
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
    page(
      '<div class="toolbar"><h1>Configurações</h1></div><div class="panel"><button id="add">' +
        icon("plus") +
        ' Adicionar lista</button><div id="profiles"></div></div>',
    );
    document.getElementById("add").onclick = function () {
      login();
    };
    var root = document.getElementById("profiles");
    root.innerHTML = N.profiles
      .map(function (p, n) {
        return (
          '<div class="profile-row ' +
          (p.id === N.active.id ? "profile-active" : "") +
          '"><strong>' +
          esc(p.name) +
          (p.id === N.active.id ? " · ATIVA" : "") +
          "</strong><span>" +
          esc(p.baseUrl) +
          '</span><button id="activate-' +
          n +
          '">' +
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
    page(
      '<div class="static-page"><div class="toolbar"><h1>Continuar assistindo</h1></div><div class="standalone-grid-viewport"><div id="continue-list" class="grid vertical-track" data-region="continue-grid"></div></div></div>',
    );
    var root = document.getElementById("continue-list");
    root.innerHTML =
      all
        .sort(function (a, b) {
          return b.updatedAt - a.updatedAt;
        })
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
          N.openPlayer(x.kind, x.item, x.title, x.kind === "episode" ? { seriesId: x.seriesId, seriesName: x.seriesName, seriesPoster: x.seriesPoster } : {});
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
