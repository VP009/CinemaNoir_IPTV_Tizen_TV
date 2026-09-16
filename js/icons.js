(function () {
  "use strict";
  var paths = {
    "arrow-left": '<path d="M21 12H4"/><path d="m10 5-7 7 7 7"/>',
    "chevron-left": '<path d="m14.5 5-7 7 7 7"/>',
    "chevron-right": '<path d="m9.5 5 7 7-7 7"/>',
    "circle-check": '<circle cx="12" cy="12" r="9.2"/><path d="m7.7 12.2 2.7 2.7 5.9-6"/>',
    "clapperboard": '<rect x="3" y="6.5" width="18" height="14" rx="3"/><path d="M3.5 10.5h17M7 3.5l-3 3M13 3.5l-3 3M19 3.5l-3 3"/><path d="m10 13.2 5 2.7-5 2.8v-5.5Z" fill="currentColor" stroke="none"/>',
    "clock": '<path d="M4.4 8.2A8.7 8.7 0 1 1 3.3 14"/><path d="M4.4 3.8v4.4H8.8M12 7.4v5l3.4 1.9"/>',
    "film": '<circle cx="11" cy="11" r="7.8"/><circle cx="11" cy="7.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.7" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="11" cy="14.8" r="1.2" fill="currentColor" stroke="none"/><circle cx="7.3" cy="11" r="1.2" fill="currentColor" stroke="none"/><path d="M17 16.5c.6 2.2 2 3.3 4 3.3"/>',
    "heart": '<path d="M20.5 9c0 5.1-8.5 9.8-8.5 9.8S3.5 14.1 3.5 9A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20.5 9Z"/>',
    "home": '<path d="m3 11.2 9-8 9 8"/><path d="M5.5 9.8v10.4h13V9.8M9.2 20.2v-6.4h5.6v6.4"/>',
    "list-end": '<path d="M4 6h9M4 11h9M4 16h6M18 5v13M14.5 14.5 18 18l3.5-3.5"/>',
    "pause": '<rect x="6" y="4" width="4.5" height="16" rx="1.5" fill="currentColor" stroke="none"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" fill="currentColor" stroke="none"/>',
    "pencil": '<path d="m4 20 4.4-1 10.8-10.8a2.4 2.4 0 0 0-3.4-3.4L5 15.6 4 20Z"/><path d="m14.3 6.3 3.4 3.4"/>',
    "play": '<path d="M7 4.5c0-.8.9-1.3 1.6-.9l11 6.6c.7.4.7 1.4 0 1.8l-11 6.6c-.7.4-1.6-.1-1.6-.9V4.5Z" fill="currentColor" stroke="none"/>',
    "plus": '<path d="M12 4.5v15M4.5 12h15"/>',
    "rotate-ccw": '<path d="M3.5 8.5V3.7M3.5 3.7h4.8"/><path d="M4.4 8.2A8.8 8.8 0 1 1 3.3 14"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.8"/><path d="m15.7 15.7 4.8 4.8"/><path d="M8 10.5h5" opacity=".55"/>',
    "series": '<rect x="5.5" y="3" width="15.5" height="16" rx="3"/><path d="M3 7.5v11A2.5 2.5 0 0 0 5.5 21H17"/><path d="m11 8 5 3-5 3V8Z" fill="currentColor" stroke="none"/>',
    "settings": '<path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="13" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="2" fill="currentColor" stroke="none"/>',
    "skip-back": '<path d="M6 5v14"/><path d="m19 5-10 7 10 7V5Z" fill="currentColor" stroke="none"/>',
    "skip-forward": '<path d="M18 5v14"/><path d="M5 5v14l10-7L5 5Z" fill="currentColor" stroke="none"/>',
    "star": '<path d="m12 2.8 2.9 5.9 6.5 1-4.7 4.5 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1L12 2.8Z"/>',
    "trash-2": '<path d="M4 7h16M9 7V4h6v3M7 7l.8 13h8.4L17 7M10 11v5M14 11v5"/>',
    "tv": '<rect x="2.5" y="4.5" width="19" height="14" rx="3"/><path d="m10 8.2 5.8 3.3-5.8 3.3V8.2Z" fill="currentColor" stroke="none"/><path d="M9 21h6"/>',
    "user": '<circle cx="12" cy="7.7" r="3.7"/><path d="M4.2 20.5a7.8 7.8 0 0 1 15.6 0"/>',
    "volume-1": '<path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" fill="currentColor" stroke="none"/><path d="M15 9a4 4 0 0 1 0 6"/>',
    "volume-2": '<path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" fill="currentColor" stroke="none"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'
  };
  window.Icons = { path: function (name) { return "assets/icons/" + String(name).toLowerCase() + ".svg"; } };
  window.iconHtml = function (name, className) {
    var key = String(name || "").toLowerCase(), content = paths[key] || paths["circle-check"];
    return '<svg class="' + (className || "ui-icon") + ' icon-' + key + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + content + '</svg>';
  };
}());
