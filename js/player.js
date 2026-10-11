(function (N) {
  "use strict";
  var root, video, av, hideTimer, saveTimer, current, activePlaybackEngine = null, playbackGeneration = 0,
    scrub = { active: false, target: 0, duration: 0, origin: 0 }, miniAv = null, miniVideo = null, miniPlane = null, miniGeneration = 0, miniItem = null, miniStartTimer = null, queuedMiniItem = null;
  function progressKey() {
    return N.key("progress", current.kind + ":" + N.contentId(current.item));
  }
  function save(force) {
    if (!current || current.kind === "live") return null;
    var position = 0,
      duration = 0;
    try {
      if (av) {
        position = av.getCurrentTime() / 1000;
        duration = av.getDuration() / 1000;
      } else if (video) {
        position = video.currentTime || 0;
        duration = video.duration || 0;
      }
    } catch (e) {
      console.log("PLAYER PROGRESS ERROR", e);
    }
    if (position <= 0 || (!force && position <= 5)) return null;
      var record = {
        profileId: N.active.id,
        position: position,
        duration: duration,
        progressPercent: duration ? Math.round((position / duration) * 100) : 0,
        title: current.title,
        item: current.item,
        kind: current.kind,
        movieId: current.kind === "movies" ? N.contentId(current.item) : null,
        seriesId: current.options.seriesId || current.item.series_id || null,
        seriesName: current.options.seriesName || current.title,
        seriesPoster: current.options.seriesPoster || current.item.cover || current.item.stream_icon || null,
        episodeId:
          current.kind === "episode" ? N.contentId(current.item) : null,
        seasonNumber: current.options.seasonNumber || current.item.season || null,
        episodeNumber: current.item.episode_num || null,
        pending: !duration,
        updatedAt: Date.now()
      };
    if (current.kind === "episode") return N.WatchProgressStore.saveEpisodeProgress(record);
    if (current.kind === "movies") return N.WatchProgressStore.saveMovieProgress(record);
    return null;
  }
  function status(message) {
    var el = root && root.querySelector(".player-status");
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    }
  }
  function configuredBufferSeconds(kind) {
    if (kind === "mini") return 10;
    var live = kind === "live", configured = N.Settings ? N.Settings.get(live ? "liveBufferSeconds" : "vodBufferSeconds") : (live ? 60 : 10);
    return live
      ? Math.max(60, Math.min(300, Math.round(Number(configured) || 60)))
      : Math.max(5, Math.min(120, Math.round(Number(configured) || 10)));
  }
  function applyAVBuffer(player, kind) {
    if (!player || !player.setBufferingParam) return;
    var seconds = configuredBufferSeconds(kind);
    try { player.setBufferingParam("PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", seconds); }
    catch (playError) { console.log("AVPLAY START BUFFER ERROR", playError); }
    try { player.setBufferingParam("PLAYER_BUFFER_FOR_RESUME", "PLAYER_BUFFER_SIZE_IN_SECOND", seconds); }
    catch (resumeError) { console.log("AVPLAY RESUME BUFFER ERROR", resumeError); }
  }
  N.stopLiveMiniPlayer = function () {
    clearTimeout(miniStartTimer);
    miniStartTimer = null;
    queuedMiniItem = null;
    miniGeneration += 1;
    if (miniVideo) {
      try { miniVideo.pause(); miniVideo.removeAttribute("src"); miniVideo.load(); } catch (ignoreVideo) {}
      if (miniVideo.parentNode) miniVideo.parentNode.removeChild(miniVideo);
      miniVideo = null;
    }
    if (miniPlane) {
      if (miniPlane.parentNode) miniPlane.parentNode.removeChild(miniPlane);
      miniPlane = null;
    }
    if (miniAv) {
      try { if (miniAv.getState() !== "NONE" && miniAv.getState() !== "IDLE") miniAv.stop(); } catch (ignoreStop) {}
      try { miniAv.close(); } catch (ignoreClose) {}
      miniAv = null;
    }
    miniItem = null;
  };
  N.queueLiveMiniPlayer = function (item, delay) {
    var stage = document.getElementById("live-mini-stage"), statusNode = document.getElementById("live-mini-status");
    if (!stage || !item || N.playerActive) return false;
    clearTimeout(miniStartTimer);
    if (miniItem && N.contentId(miniItem) === N.contentId(item)) {
      miniStartTimer = null;
      queuedMiniItem = null;
      if (statusNode) statusNode.hidden = true;
      return true;
    }
    queuedMiniItem = item;
    if (statusNode) { statusNode.hidden = false; statusNode.textContent = "Carregando prévia…"; }
    miniStartTimer = setTimeout(function () {
      var selected = queuedMiniItem;
      miniStartTimer = null;
      queuedMiniItem = null;
      if (selected && document.getElementById("live-mini-stage") === stage) N.startLiveMiniPlayer(selected);
    }, Math.max(120, Number(delay) || 360));
    return true;
  };
  N.startLiveMiniPlayer = function (item) {
    var stage = document.getElementById("live-mini-stage");
    if (!stage || !item || N.playerActive) return false;
    if (miniItem && N.contentId(miniItem) === N.contentId(item)) return true;
    N.stopLiveMiniPlayer();
    miniItem = item;
    var generation = ++miniGeneration, url = String(N.streamUrl("live", item) || "").trim(), statusNode = document.getElementById("live-mini-status"), titleNode = document.getElementById("live-playing-title");
    if (titleNode) titleNode.textContent = "Reproduzindo: " + (item.name || "Canal");
    function valid() { return generation === miniGeneration && document.getElementById("live-mini-stage") === stage; }
    function setMiniStatus(message) { if (valid() && statusNode) { statusNode.textContent = message || ""; statusNode.hidden = !message; } }
    if (typeof webapis !== "undefined" && webapis.avplay && typeof webapis.avplay.open === "function") {
      try {
        miniAv = webapis.avplay;
        miniPlane = document.createElement("object");
        var rect = stage.getBoundingClientRect(), scaleX = 1920 / Math.max(1, window.innerWidth), scaleY = 1080 / Math.max(1, window.innerHeight);
        miniPlane.type = "application/avplayer";
        miniPlane.className = "live-mini-plane";
        stage.insertBefore(miniPlane, stage.firstChild);
        miniAv.open(url);
        applyAVBuffer(miniAv, "mini");
        miniAv.setDisplayRect(Math.round(rect.left * scaleX), Math.round(rect.top * scaleY), Math.round(rect.width * scaleX), Math.round(rect.height * scaleY));
        miniAv.setListener({
          onbufferingstart: function () { setMiniStatus("Preparando canal…"); },
          onbufferingprogress: function (percent) { setMiniStatus("Buffer " + Math.max(0, Math.min(100, Math.round(Number(percent) || 0))) + "%"); },
          onbufferingcomplete: function () { setMiniStatus(""); },
          oncurrentplaytime: function () {}, onstreamcompleted: function () {}, onevent: function () {}, onsubtitlechange: function () {}, ondrmevent: function () {},
          onerror: function () { setMiniStatus("Não foi possível reproduzir a prévia."); }
        });
        miniAv.prepareAsync(function () { if (!valid()) return; try { if (miniAv.setDisplayMethod) miniAv.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); miniAv.play(); setMiniStatus(""); } catch (error) { setMiniStatus("Falha ao iniciar a prévia."); } }, function () { setMiniStatus("Prévia indisponível."); });
        return true;
      } catch (error) { N.stopLiveMiniPlayer(); miniItem = item; generation = ++miniGeneration; }
    }
    miniVideo = document.createElement("video");
    miniVideo.className = "live-mini-video";
    miniVideo.autoplay = true;
    miniVideo.src = url;
    stage.insertBefore(miniVideo, stage.firstChild);
    try { var playing = miniVideo.play(); if (playing && playing.catch) playing.catch(function () { setMiniStatus("Prévia disponível somente na TV."); }); } catch (nativeError) { setMiniStatus("Prévia disponível somente na TV."); }
    return true;
  };
  function playbackTime() {
    var position = 0, duration = 0;
    try {
      if (av) {
        position = av.getCurrentTime();
        duration = av.getDuration();
      } else if (video) {
        position = (video.currentTime || 0) * 1000;
        duration = (video.duration || 0) * 1000;
      }
    } catch (e) {
      console.log("PLAYER TIME ERROR", e);
    }
    return { position: position, duration: duration };
  }
  function renderTimeline(position, duration, preview) {
    if (!root) return;
    var bar = root.querySelector(".progress i"), time = root.querySelector(".time"), hint = root.querySelector(".seek-hint");
    if (bar) bar.style.width = (duration ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0) + "%";
    if (time) time.textContent = format(position / 1000) + " / " + format(duration / 1000);
    if (hint) { hint.hidden = !preview; hint.textContent = preview ? "Solte para ir até " + format(position / 1000) : ""; }
    root.classList.toggle("scrubbing", !!preview);
  }
  function updateNextEpisode(position, duration) {
    var prompt = root && root.querySelector(".next-episode-prompt");
    if (!prompt || !current || current.kind !== "episode" || !current.options.next || !duration) return;
    var remaining = Math.max(0, duration - position), show = remaining <= 40000;
    if (!show && N.getFocused && N.getFocused() === prompt) {
      var permanentNext = root.querySelector('.player-side-actions [data-action="next"]');
      if (permanentNext) N.focus(permanentNext);
    }
    prompt.hidden = !show;
    prompt.classList.toggle("visible", show);
    var countdown = prompt.querySelector(".next-countdown");
    if (countdown) countdown.textContent = "Termina em " + Math.ceil(remaining / 1000) + "s";
  }
  function setProgress() {
    if (!root) return;
    var time = playbackTime();
    updateNextEpisode(time.position, time.duration);
    if (scrub.active) renderTimeline(scrub.target, scrub.duration, true);
    else renderTimeline(time.position, time.duration, false);
  }
  function format(seconds) {
    if (!isFinite(seconds)) return "--:--";
    var h = Math.floor(seconds / 3600),
      m = Math.floor((seconds % 3600) / 60),
      s = Math.floor(seconds % 60);
    return (
      (h ? h + ":" : "") +
      (h && m < 10 ? "0" : "") +
      m +
      ":" +
      (s < 10 ? "0" : "") +
      s
    );
  }
  N.playerActivity = function () {
    if (!root) return;
    var ui = root.querySelector(".player-ui");
    var sideActions = root.querySelector(".player-side-actions");
    root.classList.remove("idle");
    if (ui) ui.classList.remove("hidden");
    if (sideActions) sideActions.classList.remove("hidden");
    var focused = N.getFocused && N.getFocused();
    if ((!focused || (root.contains && !root.contains(focused))) && N.focus) {
      N.focus(root.querySelector('[data-action="timeline"]') || root.querySelector("button"));
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (root) {
        root.classList.add("idle");
        if (ui) ui.classList.add("hidden");
        if (sideActions) sideActions.classList.add("hidden");
      }
    }, 3000);
  };
  N.openPlayer = function (kind, item, title, options) {
    if (N.stopLiveMiniPlayer) N.stopLiveMiniPlayer();
    if (root) N.closePlayer(true);
    playbackGeneration++;
    if (N.focusHistory) N.focusHistory.capture();
    current = { kind: kind, item: item, title: title, options: options || {} };
    N.playerActive = true;
    root = document.createElement("div");
    root.className = "player player-page";
    root.innerHTML =
      '<video id="video-player" class="video-player" playsinline></video><div class="player-status">Preparando reprodução...</div><div class="player-ui"><h2></h2><button class="player-progress-wrapper" aria-label="Linha do tempo" data-action="timeline"><span class="progress"><i></i></span><span class="time">0:00</span><span class="seek-hint" hidden></span></button><div class="row player-controls"><button class="player-control" aria-label="Voltar" data-action="close">' + iconHtml("arrow-left") + '</button><button class="player-control" aria-label="Voltar 30 segundos" data-action="backward">' + iconHtml("skip-back") + '<small>30</small></button><button class="player-control" aria-label="Pausar ou reproduzir" data-action="toggle">' + iconHtml("pause") + '</button><button class="player-control" aria-label="Avançar 30 segundos" data-action="forward">' + iconHtml("skip-forward") + '<small>30</small></button></div></div><div class="player-side-actions"></div>';
    document.body.appendChild(root);
    var sideActions = root.querySelector(".player-side-actions");
    if (current.options.prev) {
      var prev = document.createElement("button");
      prev.className = "player-control";
      prev.dataset.action = "prev";
      prev.setAttribute("aria-label", "Episódio anterior");
      prev.innerHTML = iconHtml("chevron-left");
      sideActions.appendChild(prev);
    }
    if (current.kind === "episode" && current.options.next) {
      var nextItem = current.options.nextItem || {}, currentSeasonNumber = current.options.seasonNumber || current.item.season || "",
        nextSeasonNumber = current.options.nextSeasonNumber || nextItem.season || currentSeasonNumber,
        nextSeason = String(nextSeasonNumber) !== String(currentSeasonNumber), nextControl = document.createElement("button"), next = document.createElement("button"),
        nextLabel = (nextSeasonNumber ? "S" + nextSeasonNumber + " " : "") + (nextItem.episode_num ? "E" + nextItem.episode_num + " · " : "") + (nextItem.title || current.options.seriesName || "Próximo episódio");
      nextControl.className = "player-control";
      nextControl.dataset.action = "next";
      nextControl.setAttribute("aria-label", nextSeason ? "Próxima temporada" : "Próximo episódio");
      nextControl.innerHTML = iconHtml("chevron-right");
      sideActions.appendChild(nextControl);
      next.className = "next-episode-prompt";
      next.dataset.action = "next";
      next.hidden = true;
      next.setAttribute("aria-label", nextSeason ? "Ir para a próxima temporada" : "Ir para o próximo episódio");
      next.innerHTML = iconHtml("list-end") + '<span><small class="next-kind">' + (nextSeason ? "Próxima temporada" : "Próximo episódio") + '</small><strong class="next-title"></strong><small class="next-countdown"></small></span>';
      next.querySelector(".next-title").textContent = nextLabel;
      root.appendChild(next);
    }
    root.querySelector("h2").textContent = title;
    video = root.querySelector("video");
    var useAVPlay = typeof webapis !== "undefined" && webapis.avplay;
    if (useAVPlay) {
      root.classList.add("avplay");
      var plane = document.createElement("object");
      plane.type = "application/avplayer";
      plane.className = "avplay-plane";
      root.insertBefore(plane, root.firstChild);
      document.documentElement.classList.add("avplay-active");
      document.body.classList.add("avplay-active");
      document.getElementById("app").classList.add("avplay-hidden");
      video.style.display = "none";
    }
    var url = String(N.streamUrl(kind, item) || "").trim(), saved = kind === "episode" ? N.WatchProgressStore.getEpisodeProgress(N.contentId(item)) : kind === "movies" ? N.WatchProgressStore.getMovieProgress(N.contentId(item)) : null;
    scrub = { active: false, target: 0, duration: 0, origin: 0 };
    root.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.action;
        if (a === "close") N.closePlayer();
        else if (a === "toggle") toggle(b);
        else if (a === "backward") seek(-30);
        else if (a === "forward") seek(30);
        else if (a === "prev") {
          var prev = current.options.prev;
          N.closePlayer(true);
          if (prev) setTimeout(prev, 0);
        } else if (a === "next") {
          var next = current.options.next;
          N.closePlayer(true);
          if (next) setTimeout(next, 0);
        }
        N.playerActivity();
      };
    });
    if (typeof webapis !== "undefined" && webapis.avplay)
      startAV(url, saved);

    else native(url, saved);
    saveTimer = setInterval(save, 10000);
    N.playerActivity();
    N.focus(root.querySelector('[data-action="timeline"]') || root.querySelector("button"));
    setTimeout(function () {
      if (root) N.focus(root.querySelector('[data-action="timeline"]') || root.querySelector("button"));
    }, 50);
  };
  function stopCurrentPlayback() {
    if (activePlaybackEngine === "native" && video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (activePlaybackEngine === "avplay" && av) {
      try { if (av.getState() !== "NONE" && av.getState() !== "IDLE") av.stop(); } catch (ignore) {}
      try { av.close(); } catch (ignoreClose) {}
      av = null;
    }
    activePlaybackEngine = null;
  }
  function startAV(url, saved) {
    var generation = playbackGeneration;
    if (typeof webapis === "undefined" || !webapis.avplay || typeof webapis.avplay.open !== "function") {
      status("API Samsung AVPlay indisponível. Execute o aplicativo instalado na TV.");
      return;
    }
    function valid() { return root && generation === playbackGeneration; }
    function failed(error) { if (valid()) status("AVPlay: " + (error && (error.message || error.name) || String(error || "Falha de reprodução")) + ". Verifique a transmissão ou tente outro canal."); }
    try {
      if (typeof url !== "string" || !/^https?:\/\/[^\s]+$/i.test(url)) throw new Error("URL de reprodução inválida");
      stopCurrentPlayback();
      av = webapis.avplay;
      activePlaybackEngine = "avplay";
      av.open(String(url));
      applyAVBuffer(av, current.kind);
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setListener({
        onbufferingstart: function () { if (valid()) status("Carregando…"); },
        onbufferingprogress: function (percent) {
          if (valid() && current && current.kind === "live") status("Preparando canal · " + Math.max(0, Math.min(100, Math.round(Number(percent) || 0))) + "%");
        },
        onbufferingcomplete: function () { if (valid()) status(""); },
        oncurrentplaytime: function () { if (valid()) setProgress(); },
        onstreamcompleted: function () { if (valid()) completed(); },
        onevent: function () {},
        onsubtitlechange: function () {},
        ondrmevent: function () {},
        onerror: failed
      });
      av.prepareAsync(function () {
        if (!valid()) return;
        try {
          if (av.setDisplayMethod) av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
          av.play();
          if (saved && !saved.completed && saved.position > 10 && current.kind !== "live") {
            try { av.seekTo(Math.floor(saved.position * 1000), function () {}, function () {}); } catch (ignore) {}
          }
          status("");
        } catch (error) { failed(error); }
      }, failed);
    } catch (error) { failed(error); }
  }
  function completed() {
    save(true);
    var finished = current, next = finished && finished.options && finished.options.next;
    if (finished && finished.kind === "episode") {
      N.WatchProgressStore.completeEpisode(N.contentId(finished.item));
      if (finished.options.nextItem) N.WatchProgressStore.queueNextEpisode({ profileId: N.active.id, seriesId: finished.options.seriesId, seriesName: finished.options.seriesName, seriesPoster: finished.options.seriesPoster, seasonNumber: finished.options.nextSeasonNumber || finished.options.nextItem.season, episodeNumber: finished.options.nextItem.episode_num, episodeId: N.contentId(finished.options.nextItem), item: finished.options.nextItem, title: finished.options.nextItem.title || finished.options.seriesName });
    } else if (finished && finished.kind === "movies") N.WatchProgressStore.completeMovie(N.contentId(finished.item));
    N.closePlayer(true);
    if (next) setTimeout(next, 0);
  }
  function native(url, saved) {
    var generation = playbackGeneration, media = video;
    activePlaybackEngine = "native";
    media.onerror = function () {
      if (generation === playbackGeneration) status("O navegador não reproduziu este formato. Na TV instalada, a reprodução usa Samsung AVPlay.");
    };
    media.onloadedmetadata = function () {
      if (generation !== playbackGeneration) return;
      if (saved && !saved.completed && saved.position < media.duration - 10) media.currentTime = saved.position;
      try {
        var playing = media.play();
        if (playing && playing.then) playing.then(function () { if (generation === playbackGeneration) status(""); }, function () { if (generation === playbackGeneration) status("Pressione OK para reproduzir."); });
        else status("");
      } catch (error) { status("Não foi possível iniciar o vídeo."); }
    };
    media.ontimeupdate = setProgress; media.onended = completed;
    media.src = url; media.load();
  }
  function toggle(button) {
    try {
      if (av) {
        var state = av.getState();
        if (state === "PLAYING") {
          av.pause();
          button.innerHTML = iconHtml("play");
        } else {
          av.play();
          button.innerHTML = iconHtml("pause");
        }
      } else if (video.paused) {
        video.play();
        button.innerHTML = iconHtml("pause");
      } else {
        video.pause();
        button.innerHTML = iconHtml("play");
      }
      save();
    } catch (e) {
      status("Não foi possível alterar a reprodução.");
    }
  }
  function seek(delta) {
    try {
      if (av) {
        if (delta > 0) av.jumpForward(delta * 1000);
        else av.jumpBackward(-delta * 1000);
      } else video.currentTime = Math.max(0, video.currentTime + delta);
    } catch (e) {
      N.toast("Esta transmissão não permite avançar ou voltar.");
    }
  }
  N.playerSeek = seek;
  N.playerScrubStart = function (direction) {
    var time = playbackTime();
    if (!root || current && current.kind === "live" || !time.duration) return false;
    scrub.active = true;
    scrub.origin = time.position;
    scrub.duration = time.duration;
    scrub.target = Math.max(0, Math.min(time.duration - 1000, time.position + direction * 10000));
    renderTimeline(scrub.target, scrub.duration, true);
    N.playerActivity();
    return true;
  };
  N.playerScrubBy = function (seconds) {
    if (!scrub.active) return false;
    scrub.target = Math.max(0, Math.min(scrub.duration - 1000, scrub.target + seconds * 1000));
    renderTimeline(scrub.target, scrub.duration, true);
    return true;
  };
  N.playerScrubCommit = function () {
    if (!scrub.active) return false;
    var target = scrub.target, origin = scrub.origin;
    scrub.active = false;
    try {
      if (av && typeof av.seekTo === "function") av.seekTo(Math.floor(target), save, function () { N.toast("Não foi possível ir para esta posição."); });
      else if (av) {
        var delta = target - origin;
        if (delta > 0) av.jumpForward(delta);
        else if (delta < 0) av.jumpBackward(-delta);
      } else if (video) { video.currentTime = target / 1000; save(); }
      renderTimeline(target, scrub.duration, false);
      return true;
    } catch (e) {
      renderTimeline(origin, scrub.duration, false);
      N.toast("Esta transmissão não permite avançar ou voltar.");
      return false;
    }
  };
  N.playerScrubCancel = function () {
    if (!scrub.active) return false;
    var origin = scrub.origin, duration = scrub.duration;
    scrub.active = false;
    renderTimeline(origin, duration, false);
    return true;
  };
  function volume(delta) {
    try {
      if (typeof tizen !== "undefined" && tizen.tvaudiocontrol) {
        var v = tizen.tvaudiocontrol.getVolume();
        tizen.tvaudiocontrol.setVolume(
          Math.max(0, Math.min(100, v + delta * 5))
        );
      } else
        video.volume = Math.max(0, Math.min(1, video.volume + delta * 0.1));
    } catch (e) {
      status("Não foi possível alterar o volume: " + (e.message || e));
    }
  }
  N.closePlayer = function (skipRender) {
    if (!root) return;
    /* O botão Return do controle chega aqui antes de interromper o AVPlay. */
    save(true);
    clearInterval(saveTimer);
    clearTimeout(hideTimer);
    if (N.playerScrubCancel) N.playerScrubCancel();
    playbackGeneration++;
    try {
      stopCurrentPlayback();
    } catch (e) {
      console.log("PLAYER CLEANUP ERROR", e);
    }
    root.parentNode.removeChild(root);
    root = null;
    video = null;
    av = null;
    document.documentElement.classList.remove("avplay-active");
    document.body.classList.remove("avplay-active");
    var appElement = document.getElementById("app");
    if (appElement) appElement.classList.remove("avplay-hidden");
    current = null;
    N.playerActive = false;
    if (!skipRender) N.render();
  };
})(Noir);
