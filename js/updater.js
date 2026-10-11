(function (N) {
  "use strict";
  N.APP_VERSION = "1.3.0";
  function parts(value) { return String(value || "0").split(".").map(function (part) { return parseInt(part, 10) || 0; }); }
  function newer(remote, local) { var a = parts(remote), b = parts(local), length = Math.max(a.length, b.length), i; for (i = 0; i < length; i += 1) { if ((a[i] || 0) > (b[i] || 0)) return true; if ((a[i] || 0) < (b[i] || 0)) return false; } return false; }
  function server() { return String(window.PAIRING_SERVER_URL || "").replace(/\/+$/, ""); }
  N.checkForUpdates = function (force) {
    return new Promise(function (resolve) {
      var base = server(), xhr;
      if (!/^https:\/\//i.test(base)) return resolve(null);
      xhr = new XMLHttpRequest(); xhr.open("GET", base + "/api/version?t=" + (force ? Date.now() : Math.floor(Date.now() / 1800000)), true); xhr.timeout = 7000;
      xhr.onload = function () {
        var data = null; try { data = JSON.parse(xhr.responseText || "null"); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300 && data) {
          data.updateAvailable = newer(data.version, N.APP_VERSION); N.updateInfo = data;
          if (force) N.toast(data.updateAvailable ? "Versão " + data.version + " disponível. Ative a atualização automática da TV." : "O Cinema Noir está atualizado (" + N.APP_VERSION + ").");
          window.dispatchEvent(new CustomEvent("noir:update", { detail: data })); resolve(data);
        } else resolve(null);
      };
      xhr.onerror = xhr.ontimeout = function () { if (force) N.toast("Não foi possível verificar atualizações agora."); resolve(null); };
      xhr.send();
    });
  };
})(window.Noir || (window.Noir = {}));
