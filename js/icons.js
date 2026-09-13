(function () {
  "use strict";
  window.Icons = {
    path: function (name) { return "assets/icons/" + String(name).toLowerCase() + ".svg"; }
  };
  window.iconHtml = function (name, className) {
    var image = '<img class="' + (className || "ui-icon") + '" src="' + Icons.path(name) + '" alt="" aria-hidden="true" onerror="this.onerror=null;this.src=\'assets/fallback.svg\'">';
    return image;
  };
}());
