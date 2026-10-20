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
    return iconHtml(name, "ui-icon icon-" + String(name || "sparkles"));
  }
  function normalize(s) {
    s = String(s || "").toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
  }
  function coverSrc(itemOrUrl, fallback) {
    var fallbackPath = fallback || "assets/fallback.svg";
    if (typeof itemOrUrl === "string") {
      return itemOrUrl && itemOrUrl.trim() ? itemOrUrl : fallbackPath;
    }
    if (!itemOrUrl) return fallbackPath;
    var candidates = [
      itemOrUrl.stream_icon,
      itemOrUrl.cover,
      itemOrUrl.movie_image,
      itemOrUrl.poster,
      itemOrUrl.image,
      itemOrUrl.cover_big,
      itemOrUrl.thumb,
      itemOrUrl.banner,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      if (typeof candidates[i] === "string" && candidates[i].trim()) return candidates[i];
    }
    return fallbackPath;
  }
  function header() {
    var expiry = "Sem data de expiração";
    if (N.active && N.active.account && N.active.account.exp_date) {
      var date = new Date(Number(N.active.account.exp_date) * 1000);
      expiry = isNaN(date.getTime())
        ? "Expiração não informada"
        : "Expira em " + date.toLocaleDateString("pt-BR");
    }
    return (
      '<header><div class="brand"><b>CINEMA</b> NOIR</div><span class="active-profile">' +
      esc(N.active ? N.active.name : "") +
      '</span><span id="clock"></span><button data-route="settings">' + icon("settings") + ' Configurações</button></header><div class="footer">' +
      esc(expiry) +
      '</div><div class="footer hint">OK: abrir · segure OK: favorito · Voltar: retornar</div>'
    );
  }
  function page(body, showHeader) {
    getApp().innerHTML =
      (showHeader ? header() : "") +
      '<div class="viewport ' +
      (showHeader ? "" : "full-viewport") +
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
    var e = document.getElementById("clock");
    if (e)
      e.textContent = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
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
    var defaults = edit || {
      name: "Cinema Noir",
      baseUrl: "http://ultracdn.sbs",
      username: "707407823",
      password: "481977783",
    };
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
      i.onclick = function () {
        N.openKeyboard(i);
      };
    });
    document.getElementById("save").onclick = function () {
      saveProfile(edit);
    };
    restore();
    var saveButton = document.getElementById("save");
    if (saveButton && N.focus) {
      requestAnimationFrame(function () {
        N.focus(saveButton);
      });
    }
  }
  function saveProfile(old) {
    var name = document.getElementById("name").value.trim(),
      base = document.getElementById("url").value.trim().replace(/\/+$/, ""),
      user = document.getElementById("username").value.trim(),
      pass = document.getElementById("password").value;
    if (!name || !base || !user || !pass)
      return showError("Preencha todos os campos.");
    if (!/^https?:\/\//i.test(base))
      return showError("A URL deve começar com http:// ou https://.");
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
      '<div class="eyebrow">Sua central de entretenimento</div><h1>' +
        esc(N.active.name) +
        '</h1><div class="row"><button id="home-live" class="home-card" data-route="live">'+icon("tv")+'<strong>TV ao vivo</strong><small data-count="live">Carregando…</small></button><button id="home-movies" class="home-card" data-route="movies">'+icon("film")+'<strong>Filmes</strong><small data-count="movies">Carregando…</small></button><button id="home-series" class="home-card" data-route="series">'+icon("clapperboard")+'<strong>Séries</strong><small data-count="series">Carregando…</small></button></div><div class="row"><button class="home-card secondary" data-route="continue">'+icon("clock")+'<strong>Continuar</strong></button><button class="home-card secondary" data-route="search">'+icon("search")+'<strong>Pesquisar</strong></button><button class="home-card secondary" data-route="settings">'+icon("settings")+'<strong>Configurações</strong></button></div>',
      true,
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
      '<div class="catalog-page"><div class="section-head"><button data-route="home">' +
        icon("home") +
        " Início</button><h1>" +
        names[kind] +
        '</h1><input id="filter" data-focusable="true" data-nav-down="CATEGORY_ALL" placeholder="Pesquisar em ' +
        names[kind].toLowerCase() +
        '"></div><div class="catalog-layout ' + (kind === "live" ? "live-layout" : "") + '"><aside class="category-scroll focus-viewport"><div id="categories" class="category-list vertical-track" data-region="categories"><div class="skeleton"></div></div></aside><section class="grid-scroll focus-viewport"><div id="catalog" class="media-grid vertical-track" data-region="' + (kind === "live" ? "channels" : kind + "-grid") + '"><div class="skeleton-grid"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div></div></section>' + (kind === "live" ? '<aside id="live-preview" class="live-preview">' + icon("tv") + '<h2>Selecione um canal</h2><p>O canal escolhido será reproduzido em tela cheia.</p></aside>' : '') + '</div></div>',
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
            activeCategory = String(c.category_id);
            update();
            N.focus(this);
          };
        });
        var filter = document.getElementById("filter"),
          searchTimer;
        filter.value = state.query || "";
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

  /*
   * =========================================================
   * GRID TV - GARANTE QUE AS CAPAS FIQUEM EM GRADE
   * =========================================================
   */
  function applyPosterGrid(root) {
    if (!root) return;

    var width = window.innerWidth || document.documentElement.clientWidth || 1920;
    var columns = 6;

    if (width <= 1366) {
      columns = 5;
    } else if (width <= 1920) {
      columns = 6;
    } else if (width <= 2560) {
      columns = 7;
    } else {
      columns = 8;
    }

    root.style.display = "grid";
    root.style.gridTemplateColumns = "repeat(" + columns + ", minmax(0, 1fr))";
    root.style.gridAutoFlow = "row";
    root.style.gridAutoRows = "max-content";
    root.style.alignItems = "start";
    root.style.justifyItems = "stretch";
    root.style.width = "100%";
    root.style.height = "auto";
    root.style.minHeight = "100%";
    root.style.transform = "none";
    root.style.transition = "none";

    var posters = root.querySelectorAll(".poster");

    for (var i = 0; i < posters.length; i += 1) {
      posters[i].style.display = "block";
      posters[i].style.position = "relative";
      posters[i].style.width = "100%";
      posters[i].style.minWidth = "0";
      posters[i].style.height = "auto";
      posters[i].style.transform = "none";
      posters[i].style.transition = "none";
      posters[i].style.margin = "0";
      posters[i].style.boxSizing = "border-box";
    }
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
    root.className = "media-grid vertical-track";
    root.dataset.region = kind === "live" ? "channels" : kind + "-grid";

    /* Força o catálogo a usar grade, inclusive em Tizen antigo. */
    applyPosterGrid(root);
    root.innerHTML =
      filtered
        .map(function (i, n) {
          var saved = savedProgress(kind, i),
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
            '"><img loading="lazy" decoding="async" src="' +
            esc(coverSrc(i, "assets/fallback.svg")) +
            '" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'"><span class="label"><span>' +
            esc(i.name || i.title) + (kind === "series" && saved ? " · S" + esc(saved.seasonNumber || saved.item && saved.item.season || "") + ":E" + esc(saved.episodeNumber || saved.item && saved.item.episode_num || "") : "") +
            "</span></span>" +
            (percent
              ? '<span class="card-progress"><i style="width:' +
                percent +
                '%"></i></span>'
              : "") +
            (N.isFavorite(kind, i)
              ? '<span class="star" aria-label="Favorito">' + icon("heart") + "</span>"
              : "") +
            "</button>"
          );
        })
        .join("") || '<div class="empty">Nenhum conteúdo encontrado.</div>';

    /* As capas já existem: aplicar a grade aos cards. */
    applyPosterGrid(root);

    filtered.forEach(function (item) {
      var id = (kind === "series" ? "SERIES_" : kind === "live" ? "CHANNEL_" : "MOVIE_") + N.contentId(item),
        b = document.getElementById(id);
      b.onclick = function () {
        N.focusHistory.capture(kind);
        if (kind === "live") N.focusHistory.patch(kind, { selectedChannelId: N.contentId(item), focusedChannelId: N.contentId(item) });
        open(kind, item);
      };
      b.onfocus = function () {
        if (kind === "live") {
          N.focusHistory.patch(kind, { focusedChannelId: N.contentId(item), channelIndex: Number(this.dataset.index) });
          var preview = document.getElementById("live-preview");
          if (preview) preview.innerHTML = '<img loading="lazy" decoding="async" src="' + esc(coverSrc(item, "assets/fallback.svg")) + '" onerror="this.src=\'assets/fallback.svg\'"><h2>' + esc(item.name || "Canal") + '</h2><p>Pressione OK para assistir.</p>';
        }
      };
      b._favorite = function () {
        N.favorite(kind, item);
        N.toast(
          N.isFavorite(kind, item)
            ? "Favorito adicionado"
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
        root.dataset.limit = limit + 40;
        drawCatalog(kind, items, query, category);
        setTimeout(function () {
          N.focus(
            document.getElementById("LOAD_MORE") ||
              root.querySelectorAll(".poster")[limit]
          );
        }, 20);
      };
      root.appendChild(more);
    }

    applyPosterGrid(root);
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
        ' Voltar</button><button data-route="home">' +
        icon("home") +
        ' Início</button></div><div id="details" class="status">Carregando detalhes…</div>',
    );
    document.getElementById("detail-back").onclick = N.back;
    N.request(N.active, "get_vod_info", { vod_id: N.contentId(item) })
      .then(function (info) {
        var data = info.info || {},
          saved = N.WatchProgressStore.getMovieProgress(N.contentId(item)),
          valid = N.WatchProgressStore.isResumable(saved);
        document.getElementById("details").className = "";
        document.getElementById("details").innerHTML =
          '<div class="detail detail-page"><img loading="lazy" decoding="async" src="' +
          esc(coverSrc(data.movie_image || item, "assets/fallback.svg")) +
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
        restore();
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
        ' Voltar</button><button data-route="home">' +
        icon("home") +
        ' Início</button></div><div id="details" class="status">Carregando episódios…</div>',
    );
    document.getElementById("series-back").onclick = N.back;
    N.request(N.active, "get_series_info", { series_id: N.contentId(item) })
      .then(function (info) {
        var seasons = info.episodes || {}, detailState = N.focusHistory.get("series-detail"),
          keys = Object.keys(seasons),
          latest = latestSeriesProgress(item),
          selected =
            detailState.seriesId === N.contentId(item) && seasons[String(detailState.selectedSeason)] ? String(detailState.selectedSeason) :
            latest && seasons[String(latest.seasonNumber || latest.item && latest.item.season)]
              ? String(latest.seasonNumber || latest.item.season)
              : keys[0] || "1",
          root = document.getElementById("details");
        root.className = "";
        root.innerHTML =
          '<div class="detail detail-page"><img loading="lazy" decoding="async" src="' +
          esc(
            coverSrc(
              (info.info && info.info.cover) || item,
              "assets/fallback.svg",
            ),
          ) +
          '" onerror="this.src=\'assets/fallback.svg\'"><section><div class="eyebrow">Série</div><h1>' +
          esc(item.name) +
          "</h1><p>" +
          esc((info.info && info.info.plot) || "Sem sinopse disponível.") +
          '</p><div id="series-actions" class="row"></div><div class="season-scroll focus-viewport"><div id="seasons" class="season-list horizontal-track" data-region="seasons" data-focus-row></div></div><div class="episode-scroll focus-viewport"><div id="episodes" class="episode-grid vertical-track" data-region="episodes"></div></div></section></div>';
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
              renderEpisodes();
              N.focus(document.getElementById("SEASON_" + s));
            };
          });
          renderEpisodes();
        }
        function renderEpisodes() {
          var list = seasons[selected] || [],
            out = document.getElementById("episodes");
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
          list.forEach(function (ep, n) {
            document.getElementById("EPISODE_" + N.contentId(ep)).onclick =
              function () {
                var next = list[n + 1] || null;
                if (!next) {
                  var seasonIndex = keys.indexOf(selected),
                    nextSeason = keys[seasonIndex + 1];
                  if (nextSeason && seasons[nextSeason] && seasons[nextSeason][0])
                    next = seasons[nextSeason][0];
                }
                 N.openPlayer("episode", ep, ep.title || item.name, {
                  seriesId: N.contentId(item), seriesName: item.name, seriesPoster: item.cover,
                  nextItem: next,
                  next: next
                    ? function () {
                        N.openPlayer("episode", next, next.title || item.name, { seriesId: N.contentId(item), seriesName: item.name, seriesPoster: item.cover });
                      }
                    : null,
                });
              };
          });
          restore();
        }
        renderSeasons();
        wireCommon();
        restore();
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
      '<div class="toolbar"><button data-route="home">' +
        icon("home") +
        ' Início</button><h1>Configurações</h1></div><div class="panel"><button id="add">' +
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
      '<div class="static-page"><div class="toolbar"><button class="toolbar-action" data-route="home">' + icon("home") + 'Início</button><h1>Continuar assistindo</h1></div><div class="standalone-grid-viewport"><div id="continue-list" class="grid vertical-track" data-region="continue-grid"></div></div></div>',
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
            '"><img loading="lazy" decoding="async" src="' +
            esc(coverSrc(x.seriesPoster || x.item || x, "assets/fallback.svg")) +
            '"><span class="label">' +
            esc(x.seriesName || x.title) + (x.kind === "episode" ? " · S" + esc(x.seasonNumber || x.item && x.item.season || "") + ":E" + esc(x.episodeNumber || x.item && x.item.episode_num || "") : "") + " · " +
            Math.round((x.position / Math.max(x.duration, 1)) * 100) +
            "%</span></button>"
          );
        })
        .join("") || '<div class="empty">Nada para continuar ainda.</div>';

    applyPosterGrid(root);

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
      '<div class="static-page"><div class="toolbar"><button class="toolbar-action" data-route="home">' + icon("home") + 'Início</button><h1>Pesquisar</h1></div><div class="panel search-panel"><input id="global-search" placeholder="Pesquisar em filmes, séries e canais"><p>Escolha uma seção na tela inicial para filtrar também por categoria e favoritos.</p></div><div class="standalone-grid-viewport search-grid-viewport"><div id="search-results" class="grid vertical-track" data-region="search-grid"></div></div></div>',
    );
    var input = document.getElementById("global-search");
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
                '"><img loading="lazy" decoding="async" src="' +
                esc(
                  coverSrc(x.item, "assets/fallback.svg"),
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
