(function () {
  'use strict';
  window.Noir = window.Noir || {};
  Noir.fail = function (message) {
    var text = 'Não foi possível iniciar o Cinema Noir. ' + message + ' Feche e abra o aplicativo novamente.';
    var show = function () {
      var el = document.getElementById('fatal');
      if (!el) return;
      el.hidden = false;
      el.textContent = text;
    };
    if (document.body) show();
    else window.addEventListener('DOMContentLoaded', show);
  };
  window.addEventListener('error', function (e) { if (!Noir.started) Noir.fail(e.message || 'Verifique os arquivos do projeto.'); });
}());
