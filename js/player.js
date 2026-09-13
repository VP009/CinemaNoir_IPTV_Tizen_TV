(function (N) {
  "use strict";
  var root, video, av, hideTimer, saveTimer, current, activePlaybackEngine = null, playbackGeneration = 0;
  function progressKey() {
    return N.key("progress", current.kind + ":" + N.contentId(current.item));
  }
  function save() {
    if (!current) return;
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
    if (position <= 5) return;
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
        seasonNumber: current.item.season || null,
        episodeNumber: current.item.episode_num || null,
        updatedAt: Date.now()
      };
    if (current.kind === "episode") N.WatchProgressStore.saveEpisodeProgress(record);
    else if (current.kind === "movies") N.WatchProgressStore.saveMovieProgress(record);
  }
  function status(message) {
    var el = root && root.querySelector(".player-status");
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    }
  }
  function setProgress() {
    if (!root) return;
    var position = 0,
      duration = 0;
    try {
      if (av) {
        position = av.getCurrentTime();
        duration = av.getDuration();
      } else {
        position = video.currentTime * 1000;
        duration = video.duration * 1000;
      }
    } catch (e) {
      console.log("PLAYER TIME ERROR", e);
    }
    var bar = root.querySelector(".progress i");
    bar.style.width =
      (duration ? Math.min(100, (position / duration) * 100) : 0) + "%";
    root.querySelector(".time").textContent =
      format(position / 1000) + " / " + format(duration / 1000);
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
    root.classList.remove("idle");
    root.querySelector(".player-ui").classList.remove("hidden");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (root) {
        root.classList.add("idle");
        root.querySelector(".player-ui").classList.add("hidden");
      }
    }, 3000);
  };
  N.openPlayer = function (kind, item, title, options) {
    if (root) N.closePlayer();
    playbackGeneration++;
    if (N.focusHistory) N.focusHistory.capture();
    current = { kind: kind, item: item, title: title, options: options || {} };
    N.playerActive = true;
    root = document.createElement("div");
    root.className = "player player-page";
    root.innerHTML =
      '<video id="video-player" class="video-player" playsinline></video><div class="player-status">Preparando reprodução...</div><div class="player-ui"><h2></h2><button class="player-progress-wrapper" aria-label="Linha do tempo" data-action="timeline"><span class="progress"><i></i></span><span class="time">0:00</span></button><div class="row player-controls"><button class="player-control" aria-label="Voltar" data-action="close">' + iconHtml("arrow-left") + '</button><button class="player-control" aria-label="Voltar 30 segundos" data-action="backward">' + iconHtml("skip-back") + '<small>30</small></button><button class="player-control" aria-label="Pausar ou reproduzir" data-action="toggle">' + iconHtml("pause") + '</button><button class="player-control" aria-label="Avançar 30 segundos" data-action="forward">' + iconHtml("skip-forward") + '<small>30</small></button></div></div><div class="player-side-actions"></div>';
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
    if (current.options.next) {
      var next = document.createElement("button");
      next.className = "player-control";
      next.dataset.action = "next";
      next.setAttribute("aria-label", "Próximo episódio");
      next.innerHTML = iconHtml("list-end");
      sideActions.appendChild(next);
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
    var url = N.streamUrl(kind, item), saved = kind === "episode" ? N.WatchProgressStore.getEpisodeProgress(N.contentId(item)) : kind === "movies" ? N.WatchProgressStore.getMovieProgress(N.contentId(item)) : null;
    root.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.action;
        if (a === "close") N.closePlayer();
        else if (a === "toggle") toggle(b);
        else if (a === "backward") seek(-30);
        else if (a === "forward") seek(30);
        else if (a === "prev") {
          var prev = current.options.prev;
          N.closePlayer();
          if (prev) setTimeout(prev, 0);
        } else if (a === "next") {
          var next = current.options.next;
          N.closePlayer();
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
    setTimeout(function () {
      if (root) N.focus(root.querySelector("button"));
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
    function failed(error) { if (valid()) status("AVPlay: " + (error && error.name || String(error || "Falha de reprodução")) + ". Verifique a transmissão ou tente outro canal."); }
    try {
      stopCurrentPlayback();
      av = webapis.avplay;
      activePlaybackEngine = "avplay";
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setListener({
        onbufferingstart: function () { if (valid()) status("Carregando…"); },
        onbufferingcomplete: function () { if (valid()) status(""); },
        oncurrentplaytime: function () { if (valid()) setProgress(); },
        onstreamcompleted: function () { if (valid()) completed(); },
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
    save();
    var finished = current, next = finished && finished.options && finished.options.next;
    if (finished && finished.kind === "episode") {
      N.WatchProgressStore.completeEpisode(N.contentId(finished.item));
      if (finished.options.nextItem) N.WatchProgressStore.queueNextEpisode({ profileId: N.active.id, seriesId: finished.options.seriesId, seriesName: finished.options.seriesName, seriesPoster: finished.options.seriesPoster, seasonNumber: finished.options.nextItem.season, episodeNumber: finished.options.nextItem.episode_num, episodeId: N.contentId(finished.options.nextItem), item: finished.options.nextItem, title: finished.options.nextItem.title || finished.options.seriesName });
    } else if (finished && finished.kind === "movies") N.WatchProgressStore.completeMovie(N.contentId(finished.item));
    N.closePlayer();
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
  N.closePlayer = function () {
    if (!root) return;
    save();
    clearInterval(saveTimer);
    clearTimeout(hideTimer);
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
    N.render();
  };
})(Noir);
