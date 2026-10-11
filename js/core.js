(function (N) {
  'use strict';
  N.read = function (key, fallback) { try { var value = localStorage.getItem('noir:' + key); return value === null ? fallback : JSON.parse(value); } catch (e) { return fallback; } };
  N.write = function (key, value) { try { localStorage.setItem('noir:' + key, JSON.stringify(value)); return true; } catch (e) { N.toast('Armazenamento cheio ou indisponível. Os dados não foram salvos.'); return false; } };
  N.toast = function (message) { var el = document.getElementById('toast'); el.textContent = message; el.style.display = 'block'; clearTimeout(N.toastTimer); N.toastTimer = setTimeout(function () { el.style.display = 'none'; }, 3500); };
  N.profiles = N.read('profiles', []); N.active = null; N.generation = 0; N.requests = []; N.cache = {};
  N.profiles.forEach(function (p) { if (p.account) return; p.account = null; });
  N.key = function (type, id) { return N.active.id + ':' + type + (id === undefined ? '' : ':' + id); };
  N.cancel = function () { N.generation++; N.requests.slice().forEach(function (xhr) { xhr.abort(); }); N.requests = []; };
  N.activate = function (id) { N.cancel(); N.active = N.profiles.filter(function (p) { return p.id === id && p.enabled !== false; })[0] || null; if (N.active) { N.active.lastUsedAt = new Date().toISOString(); N.write('profiles', N.profiles); N.write('active', id); } };
  N.request = function (profile, action, params) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest(), generation = N.generation;
    var serverBase = 'http://' + String(profile.baseUrl || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    var url = serverBase + '/player_api.php?username=' + encodeURIComponent(profile.username) + '&password=' + encodeURIComponent(profile.password);
      if (action) url += '&action=' + encodeURIComponent(action);
      Object.keys(params || {}).forEach(function (key) { url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); });
      N.requests.push(xhr); xhr.open('GET', url, true); xhr.timeout = 15000;
      function finish(error, data) { var i = N.requests.indexOf(xhr); if (i >= 0) N.requests.splice(i, 1); if (generation !== N.generation) return reject(new Error('cancelled')); if (error) reject(new Error(error)); else resolve(data); }
      xhr.onload = function () { if (xhr.status === 401 || xhr.status === 403) return finish('Usuário ou senha inválidos.'); if (xhr.status < 200 || xhr.status >= 300) return finish('Servidor indisponível (HTTP ' + xhr.status + ').'); try { finish(null, JSON.parse(xhr.responseText)); } catch (e) { finish('O servidor retornou uma resposta inválida.'); } };
      xhr.onerror = function () { finish('Não foi possível conectar. Verifique a rede, a URL, o certificado e a permissão CORS do servidor.'); };
      xhr.ontimeout = function () { finish('Tempo de conexão esgotado. Tente novamente.'); }; xhr.onabort = function () { finish('cancelled'); }; xhr.send();
    });
  };
  N.authenticate = function (p) { return N.request(p).then(function (data) { if (!data.user_info || Number(data.user_info.auth) !== 1) throw new Error('Usuário ou senha inválidos.'); if (data.user_info.status && data.user_info.status !== 'Active') throw new Error('Lista inativa: ' + data.user_info.status); p.account = data.user_info; return p; }); };
  N.catalog = function (kind) { var key = N.key('cache', kind), cached = N.cache[key]; if (cached && Date.now() - cached.time < 300000) return Promise.resolve(cached.data); var actions = {live:'get_live_streams',movies:'get_vod_streams',series:'get_series'}; return N.request(N.active, actions[kind]).then(function (data) { if (!Array.isArray(data)) throw new Error('Catálogo inválido.'); N.cache[key] = {time:Date.now(),data:data}; return data; }); };
  N.categories = function (kind) { var key = N.key('cache', 'categories:' + kind), cached = N.cache[key], stored = N.PersistentCache && N.PersistentCache.get(key); if (cached && Date.now() - cached.time < 300000) return Promise.resolve(cached.data); if (stored) { N.cache[key] = {time:Date.now(),data:stored}; return Promise.resolve(stored); } return N.request(N.active, {live:'get_live_categories',movies:'get_vod_categories',series:'get_series_categories'}[kind]).then(function (d) { d = Array.isArray(d) ? d : []; N.cache[key] = {time:Date.now(),data:d}; if (N.PersistentCache) N.PersistentCache.set(key,d,86400000); return d; }); };
  N.epg = function (item, limit) { var id = N.contentId(item), key = N.key('cache', 'epg:' + id), cached = N.cache[key], stored = N.PersistentCache && N.PersistentCache.get(key); if (cached && Date.now() - cached.time < 120000) return Promise.resolve(cached.data); if (stored) { N.cache[key] = {time:Date.now(),data:stored}; return Promise.resolve(stored); } return N.request(N.active, 'get_short_epg', {stream_id:id,limit:limit || 4}).then(function (d) { var data = d && Array.isArray(d.epg_listings) ? d.epg_listings : []; N.cache[key] = {time:Date.now(),data:data}; if (N.PersistentCache) N.PersistentCache.set(key,data,300000); return data; }); };
  N.contentId = function (item) { return String(item.stream_id || item.series_id || item.id); };
  N.favorite = function (kind, item) { var key = N.key('favorites'), items = N.read(key, {}), id = kind + ':' + N.contentId(item); if (items[id]) delete items[id]; else items[id] = {kind:kind,item:item}; N.write(key, items); return !!items[id]; };
  N.getFavorites = function () { return N.read(N.key('favorites'), {}); };
  N.isFavorite = function (kind, item) { return !!N.read(N.key('favorites'), {})[kind + ':' + N.contentId(item)]; };
  N.streamUrl = function (kind, item) { var p = N.active, base = 'http://' + String(p.baseUrl || '').replace(/^https?:\/\//i, '').replace(/\/+$/, ''); var ext = kind === 'live' ? 'm3u8' : String(item.container_extension || 'mp4').replace(/[^a-z0-9]/gi, ''); return base + '/' + ({live:'live',movies:'movie',episode:'series'}[kind]) + '/' + encodeURIComponent(p.username) + '/' + encodeURIComponent(p.password) + '/' + encodeURIComponent(N.contentId(item)) + '.' + ext; };
}(Noir));
