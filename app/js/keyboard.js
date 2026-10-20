(function (N) {
  "use strict";
  var panel,
    field,
    upper = false,
    mode = "letters";
  N.closeKeyboard = function (cancel) {
    if (!panel) return false;
    if (cancel && panel._initial !== undefined) field.value = panel._initial;
    var target = field;
    panel.parentNode.removeChild(panel);
    panel = null;
    field = null;
    if (target && document.documentElement.contains(target)) N.focus(target);
    else N.restorePreviousFocus();
    return true;
  };
  N.openKeyboard = function (input) {
    N.closeKeyboard();
    N.rememberFocus();
    field = input;
    upper = false;
    mode = "letters";
    panel = document.createElement("div");
    panel.className = "keyboard keyboard-floating";
    if (input.id === "global-search") panel.classList.add("keyboard-below-search");
    panel._initial = input.value;
    document.body.appendChild(panel);
    draw();
    place();
    N.focus(panel.querySelector("button"));
  };
  function place() {
    if (!panel || !field) return;
    var r = field.getBoundingClientRect(),
      useSidePlacement = field.getAttribute("data-search-input") === "true";

    if (field.id === "global-search") {
      var searchWidth = Math.min(1180, window.innerWidth - 80);
      panel.style.width = searchWidth + "px";
      panel.style.left = Math.max(40, (window.innerWidth - searchWidth) / 2) + "px";
      panel.style.top = Math.max(20, Math.min(window.innerHeight - panel.offsetHeight - 24, r.bottom + 14)) + "px";
      return;
    }

    if (useSidePlacement) {
      var sideWidth = Math.min(760, Math.max(340, window.innerWidth - r.right - 80));
      panel.style.width = sideWidth + "px";
      panel.style.left = Math.max(
        40,
        Math.min(window.innerWidth - sideWidth - 40, r.right + 24),
      ) + "px";
      panel.style.top = Math.max(20, Math.min(window.innerHeight - panel.offsetHeight - 20, r.top)) + "px";
      return;
    }

    var width = Math.min(Math.max(r.width, 760), window.innerWidth - 80);
    panel.style.width = width + "px";
    panel.style.left =
      Math.max(40, Math.min(window.innerWidth - width - 40, r.left)) + "px";
    panel.style.top =
      Math.min(window.innerHeight - panel.offsetHeight - 30, r.bottom + 12) +
      "px";
  }
  function update(value) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function draw() {
    panel.textContent = "";
    if (field && field.id === "url") {
      var shortcuts = document.createElement("div");
      shortcuts.className = "row url-shortcuts";
      [
        ["http://", "http://"],
        ["https://", "https://"],
        [".com", ".com"],
        [":", ":"],
        ["/", "/"],
        [".", "."],
      ].forEach(function (entry) {
        var b = document.createElement("button");
        b.textContent = entry[0];
        b.onclick = function () {
          update(field.value + entry[1]);
        };
        shortcuts.appendChild(b);
      });
      panel.appendChild(shortcuts);
    }
    var keys = document.createElement("div");
    keys.className = "keys";
    panel.appendChild(keys);
    var chars =
      mode === "symbols"
        ? "@.:/-_?&=+!#$%(),;[]"
        : "1234567890qwertyuiopasdfghjklzxcvbnm";
    if (upper) chars = chars.toUpperCase();
    chars.split("").forEach(function (c) {
      var b = document.createElement("button");
      b.textContent = c;
      b.onclick = function () {
        update(field.value + c);
      };
      keys.appendChild(b);
    });
    var row = document.createElement("div");
    row.className = "row";
    panel.appendChild(row);
    [
      [
        "Aa",
        function () {
          upper = !upper;
          draw();
          place();
          N.focus(panel.querySelector("button"));
        },
      ],
      [
        "abc",
        function () {
          mode = "letters";
          draw();
          place();
          N.focus(panel.querySelector("button"));
        },
      ],
      [
        "@#",
        function () {
          mode = "symbols";
          draw();
          place();
          N.focus(panel.querySelector("button"));
        },
      ],
      [
        "Espaço",
        function () {
          update(field.value + " ");
        },
      ],
      [
        "Apagar",
        function () {
          update(field.value.slice(0, -1));
        },
      ],
      [
        "Limpar",
        function () {
          update("");
        },
      ],
      [
        "Cancelar",
        function () {
          N.closeKeyboard(true);
        },
      ],
      [
        "Concluir",
        function () {
          N.closeKeyboard(false);
        },
      ],
    ].forEach(function (entry) {
      var b = document.createElement("button");
      b.textContent = entry[0];
      b.onclick = entry[1];
      row.appendChild(b);
    });
  }
  document.addEventListener(
    "keydown",
    function (e) {
      if (!panel || e.ctrlKey || e.metaKey || e.altKey) return;
      var code = e.keyCode || e.which;
      var key = e.key || "";

      if (key && key.length === 1) {
        e.preventDefault();
        update(field.value + key);
        return;
      }

      if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
        e.preventDefault();
        var digit = String.fromCharCode(code >= 96 ? code - 48 : code);
        update(field.value + digit);
        return;
      }

      if (code === 32) {
        e.preventDefault();
        update(field.value + " ");
        return;
      }

      if (code === 8) {
        e.preventDefault();
        update(field.value.slice(0, -1));
      }
    },
    true,
  );
})(Noir);
