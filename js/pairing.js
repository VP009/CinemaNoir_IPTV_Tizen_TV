(function (N) {
  "use strict";
  var timer = null, session = 0, processing = false;
  function baseUrl() { return String(window.PAIRING_SERVER_URL || "").replace(/\/+$/, ""); }
  function configured() { return /^https:\/\//i.test(baseUrl()) && baseUrl().indexOf("SEU-PROJETO") < 0; }
  function randomHex(bytes) {
    var values = new Uint8Array(bytes), out = "", i;
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values); else for (i = 0; i < values.length; i += 1) values[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < values.length; i += 1) out += (values[i] + 256).toString(16).slice(-2); return out;
  }
  function randomCode() {
    var values = new Uint8Array(6), code = "", i;
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values); else for (i = 0; i < values.length; i += 1) values[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < values.length; i += 1) code += String(values[i] % 10); return code;
  }
  function deviceState() {
    return { activeId: N.active && N.active.id || "", lists: (N.profiles || []).map(function (profile) { return { id: profile.id, name: profile.name }; }) };
  }
  function request(method, url, body, done) {
    var xhr = new XMLHttpRequest(); xhr.open(method, url, true); xhr.timeout = 10000;
    if (body) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () { var data = {}; try { data = JSON.parse(xhr.responseText || "{}"); } catch (ignore) {} done(xhr.status >= 200 && xhr.status < 300 ? null : new Error(data.error || "Servidor indisponível."), data, xhr.status); };
    xhr.onerror = function () { done(new Error("Não foi possível acessar o servidor de pareamento.")); }; xhr.ontimeout = function () { done(new Error("O servidor de pareamento demorou para responder.")); }; xhr.send(body ? JSON.stringify(body) : null);
  }
  function setStatus(text, state) { var element = document.querySelector(".pairing-status"); if (!element) return; element.textContent = text; element.className = "pairing-status" + (state ? " " + state : ""); }
  function saveProfiles() { N.write("profiles", N.profiles); }
  function applyCommand(command) {
    if (command.type === "add") {
      var list = command.list, now = new Date().toISOString(), profile = { id: "p" + Date.now(), name: list.name, baseUrl: "http://" + String(list.baseUrl).replace(/^https?:\/\//i, "").replace(/\/+$/, ""), username: list.username, password: list.password, createdAt: now, lastUsedAt: now };
      return N.authenticate(profile).then(function () {
        var duplicate = -1, i;
        for (i = 0; i < N.profiles.length; i += 1) if (N.profiles[i].baseUrl === profile.baseUrl && N.profiles[i].username === profile.username) { duplicate = i; break; }
        if (duplicate >= 0) { profile.id = N.profiles[duplicate].id; profile.createdAt = N.profiles[duplicate].createdAt; N.profiles[duplicate] = profile; } else N.profiles.push(profile);
        saveProfiles(); N.activate(profile.id); return "Lista “" + profile.name + "” adicionada e ativada.";
      });
    }
    if (command.type === "activate") {
      var found = N.profiles.some(function (profile) { return profile.id === command.profileId; });
      if (!found) return Promise.reject(new Error("Lista não encontrada na TV."));
      N.activate(command.profileId); return Promise.resolve("Lista ativada.");
    }
    if (command.type === "remove") {
      var removed = null;
      N.profiles = N.profiles.filter(function (profile) { if (profile.id === command.profileId) { removed = profile; return false; } return true; });
      if (!removed) return Promise.reject(new Error("Lista não encontrada na TV."));
      saveProfiles();
      if (N.active && N.active.id === command.profileId) { if (N.profiles.length) N.activate(N.profiles[0].id); else { N.active = null; N.write("active", null); } }
      return Promise.resolve("Lista “" + removed.name + "” removida.");
    }
    return Promise.reject(new Error("Comando desconhecido."));
  }
  N.pairingMarkup = function () { return '<div class="home-pairing"><span>Gerencie listas pelo celular</span><strong class="pairing-url">' + baseUrl() + '/pair</strong><small class="pairing-status">Preparando código…</small></div>'; };
  N.stopPairing = function () { session += 1; processing = false; if (timer) clearInterval(timer); timer = null; };
  N.startPairing = function () {
    N.stopPairing(); if (!document.querySelector(".home-pairing")) return;
    if (!configured()) { setStatus("Informe o domínio da Vercel no arquivo de configuração.", "error"); return; }
    var currentSession = session, code = randomCode(), token = randomHex(24), api = baseUrl() + "/api/pair";
    function active() { return currentSession === session && !!document.querySelector(".home-pairing"); }
    function acknowledge(command, status, message) {
      request("POST", api, { action: "ack", code: code, token: token, commandId: command.id, status: status, message: message, device: deviceState() }, function () {
        processing = false;
        if (!active()) return;
        setStatus("Código: " + code.slice(0, 3) + " " + code.slice(3) + " · gerencie quantas listas quiser", status === "error" ? "error" : "ready");
        if (status !== "error") {
          var activeName = document.querySelector(".home-intro p");
          if (activeName && N.active) activeName.textContent = N.active.name;
          N.toast(message);
          if (!N.active) N.render();
        }
      });
    }
    function poll() {
      if (!active() || processing) return;
      request("GET", api + "?code=" + encodeURIComponent(code) + "&token=" + encodeURIComponent(token), null, function (error, data, httpStatus) {
        if (!active()) return;
        if (error) { if (httpStatus === 404) N.startPairing(); return; }
        var command = data.commands && data.commands[0]; if (!command) return;
        processing = true; setStatus("Aplicando alteração recebida…", "ready");
        applyCommand(command).then(function (message) { acknowledge(command, "success", message); }).catch(function (commandError) { acknowledge(command, "error", commandError.message || "Não foi possível aplicar a alteração."); });
      });
    }
    request("POST", api, { action: "create", code: code, token: token, device: deviceState() }, function (error, data, httpStatus) {
      if (!active()) return;
      if (error) { if (httpStatus === 409) { N.startPairing(); return; } setStatus(error.message, "error"); return; }
      setStatus("Código: " + code.slice(0, 3) + " " + code.slice(3) + " · válido por 15 minutos", "ready"); timer = setInterval(poll, 3000); poll();
    });
  };
})(window.Noir || (window.Noir = {}));
