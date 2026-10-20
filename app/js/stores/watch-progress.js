(function (N) {
  "use strict";
  function profileId(value) { return String(value || (N.active && N.active.id) || "none"); }
  function key(profile, type, id) { return "noir:" + profileId(profile) + ":progress:" + type + ":" + String(id); }
  function readKey(storageKey) { try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch (e) { return null; } }
  function writeKey(storageKey, value) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("noir:progress", { detail: value }));
      return value;
    } catch (e) { N.toast("Não foi possível salvar o progresso."); return null; }
  }
  function ratio(record) { return record && record.duration > 0 ? record.position / record.duration : 0; }
  function complete(record) { return !!record && (ratio(record) >= 0.98 || (record.duration > 30 && record.duration - record.position <= 30)); }
  function resumable(record) { return !!record && !record.completed && !complete(record) && (record.pending || ratio(record) >= 0.02); }
  function records(profile, type) {
    var prefix = "noir:" + profileId(profile) + ":progress:" + type + ":", out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var storageKey = localStorage.key(i);
      if (storageKey && storageKey.indexOf(prefix) === 0) { var value = readKey(storageKey); if (value) out.push(value); }
    }
    return out;
  }
  function base(record) {
    var duration = Number(record.duration || 0), position = Math.max(0, Number(record.position || 0));
    return Object.assign({}, record, {
      profileId: profileId(record.profileId), position: position, duration: duration,
      progressPercent: duration ? Math.min(100, Math.round((position / duration) * 1000) / 10) : 0,
      updatedAt: Number(record.updatedAt || Date.now())
    });
  }
  N.WatchProgressStore = {
    saveMovieProgress: function (record) {
      record = base(record); record.kind = "movies";
      record.movieId = String(record.movieId || (record.item && N.contentId(record.item)) || "");
      record.completed = complete(record);
      return writeKey(key(record.profileId, "movies", record.movieId), record);
    },
    saveEpisodeProgress: function (record) {
      record = base(record); record.kind = "episode";
      record.episodeId = String(record.episodeId || (record.item && N.contentId(record.item)) || "");
      record.seriesId = String(record.seriesId || (record.item && record.item.series_id) || "");
      record.completed = complete(record);
      return writeKey(key(record.profileId, "episode", record.episodeId), record);
    },
    getMovieProgress: function (movieId, profile) { return readKey(key(profile, "movies", movieId)); },
    getEpisodeProgress: function (episodeId, profile) { return readKey(key(profile, "episode", episodeId)); },
    getSeriesResume: function (seriesId, profile) {
      var id = String(seriesId);
      return records(profile, "episode").filter(function (r) {
        return String(r.seriesId || (r.item && r.item.series_id) || "") === id && resumable(r);
      }).sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0] || null;
    },
    getContinueWatchingMovies: function (profile) { return records(profile, "movies").filter(resumable).sort(function (a, b) { return b.updatedAt - a.updatedAt; }); },
    getContinueWatchingSeries: function (profile) {
      var grouped = {};
      records(profile, "episode").filter(resumable).forEach(function (r) {
        var id = String(r.seriesId || (r.item && r.item.series_id) || "");
        if (id && (!grouped[id] || grouped[id].updatedAt < r.updatedAt)) grouped[id] = r;
      });
      return Object.keys(grouped).map(function (id) { return grouped[id]; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    },
    completeMovie: function (movieId, profile) {
      var r = this.getMovieProgress(movieId, profile); if (!r) return null;
      r.completed = true; r.progressPercent = 100; r.updatedAt = Date.now(); return writeKey(key(profile, "movies", movieId), r);
    },
    completeEpisode: function (episodeId, profile) {
      var r = this.getEpisodeProgress(episodeId, profile); if (!r) return null;
      r.completed = true; r.progressPercent = 100; r.updatedAt = Date.now(); return writeKey(key(profile, "episode", episodeId), r);
    },
    queueNextEpisode: function (record) {
      return this.saveEpisodeProgress(Object.assign({}, record, { position: 0, duration: 0, pending: true, completed: false, updatedAt: Date.now() }));
    },
    isResumable: resumable,
    isComplete: complete
  };
})(Noir);
