const fs = require("fs"), vm = require("vm"), assert = require("assert");

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return Array.from(data.keys())[index] || null; }
  };
}

async function main() {
  const timers = [], probes = [], N = {};
  function setTimer(fn) { const entry = { fn, cancelled: false }; timers.push(entry); return entry; }
  const context = {
    Noir: N, tizen: {}, localStorage: storage(), setTimeout: setTimer,
    clearTimeout(timer) { if (timer) timer.cancelled = true; },
    window: { Noir: N, addEventListener() {}, caches: null },
    document: { documentElement: { contains() { return true; } } },
    Image: function () { probes.push(this); }, URL: { createObjectURL() {}, revokeObjectURL() {} },
    Promise, Object, Array, String, Number, Math, Date
  };
  vm.runInNewContext(fs.readFileSync("js/performance.js", "utf8"), context);

  const titles = [{ name: "Ação Total" }, { title: "Coração Valente" }];
  N.prepareCatalogSearchIndex(titles);
  while (timers.length) { const timer = timers.shift(); if (!timer.cancelled) timer.fn(); }
  assert.equal(N.catalogSearchText(titles[0]), "acao total");
  assert.equal(N.catalogSearchText(titles[1]), "coracao valente");

  const images = [0, 1, 2].map(() => ({ dataset: { src: "http://img/test.jpg" }, classList: { add() {} }, src: "" }));
  N.setNavigationBusy(true);
  N.loadImages({ querySelectorAll() { return images; } });
  assert.equal(probes.length, 0, "imagens não devem iniciar durante a navegação");
  N.setNavigationBusy(false);
  assert.equal(probes.length, 2, "Tizen deve limitar a duas decodificações simultâneas");
  probes[0].onload();
  assert.equal(probes.length, 3, "a terceira imagem inicia somente após liberar uma vaga");

  let aborted = false;
  function XHR() { this.status = 200; }
  XHR.prototype.open = function () {};
  XHR.prototype.send = function () {};
  XHR.prototype.abort = function () { aborted = true; if (this.onabort) this.onabort(); };
  const coreN = {};
  const coreContext = {
    Noir: coreN, localStorage: storage(), XMLHttpRequest: XHR, Promise, Object, Array, String, Number, Math, Date,
    encodeURIComponent, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync("js/core.js", "utf8"), coreContext);
  const request = coreN.request({ baseUrl: "server", username: "u", password: "p" }, "test");
  request.catch(() => {}); request.abort();
  assert.equal(aborted, true, "a requisição antiga deve ser abortável");
  await Promise.resolve();
  console.log("PASS: imagens pausam durante o D-pad, busca é pré-indexada e requisições antigas são canceláveis.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
