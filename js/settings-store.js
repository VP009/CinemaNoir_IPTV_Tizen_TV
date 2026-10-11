(function (N) {
  "use strict";
  var storageKey = "settings";
  N.ThemeCatalog = [
    { id: "noir", name: "Cinema Noir", description: "Violeta cinematográfico", colors: { background: "#07060B", surface: "#15101E", primary: "#A78BFA", focus: "#DDD6FE", text: "#FAF9FF", textSecondary: "#B9B3C5" } },
    { id: "ocean", name: "Ocean Depth", description: "Ciano profundo e orgânico", colors: { background: "#020D14", surface: "#082431", primary: "#22D3EE", focus: "#67E8F9", text: "#F1FCFF", textSecondary: "#A9CBD4" } },
    { id: "midnight", name: "Midnight Blue", description: "Azul noturno sofisticado", colors: { background: "#080F1D", surface: "#15243A", primary: "#388BFF", focus: "#6AAEFF", text: "#F3F8FF", textSecondary: "#9DAFC5" } },
    { id: "amoled", name: "AMOLED Black", description: "Preto absoluto e contraste máximo", colors: { background: "#000000", surface: "#161616", primary: "#F4F4F4", focus: "#FFFFFF", text: "#FFFFFF", textSecondary: "#AAAAAA" } },
    { id: "arctic", name: "Arctic Light", description: "Claro, frio e espaçoso", colors: { background: "#F2F6FA", surface: "#FFFFFF", primary: "#2367D5", focus: "#397FEA", text: "#14243B", textSecondary: "#64758C" } },
    { id: "cyber", name: "Cyber Neon", description: "Magenta elétrico e futurista", colors: { background: "#090B1B", surface: "#1A1B39", primary: "#E34BFF", focus: "#FF81EF", text: "#F9F3FF", textSecondary: "#A8A6CE" } },
    { id: "graphite", name: "Graphite Orange", description: "Industrial escuro e laranja", colors: { background: "#111315", surface: "#25282B", primary: "#FF914D", focus: "#FFB47B", text: "#F8F8F6", textSecondary: "#A8ACAF" } },
    { id: "mint", name: "Mint Frost", description: "Verde suave e refrescante", colors: { background: "#EAF4F1", surface: "#FFFFFF", primary: "#087F70", focus: "#16A991", text: "#173630", textSecondary: "#637F78" } },
    { id: "sunset", name: "Sunset Horizon", description: "Coral quente ao anoitecer", colors: { background: "#111324", surface: "#29253A", primary: "#FF805F", focus: "#FFB18E", text: "#FFF5F0", textSecondary: "#B8ABB9" } },
    { id: "titanium", name: "Titanium Pro", description: "Metal frio e preciso", colors: { background: "#101419", surface: "#252D36", primary: "#91B6D9", focus: "#C2DFFF", text: "#F3F7FB", textSecondary: "#9EAAB7" } },
    { id: "ice", name: "Ice Quantum", description: "Azul glacial luminoso", colors: { background: "#070D16", surface: "#182638", primary: "#69CFFF", focus: "#A3E8FF", text: "#F0FAFF", textSecondary: "#96AFC4" } }
  ];
  N.ShortcutActions = [
    { id: "continue", label: "Continuar" },
    { id: "search", label: "Pesquisar" },
    { id: "settings", label: "Configurações" },
    { id: "favorite", label: "Favoritar" },
    { id: "home", label: "Início" },
    { id: "live", label: "TV ao vivo" },
    { id: "movies", label: "Filmes" },
    { id: "series", label: "Séries" }
  ];
  var shortcutValues = N.ShortcutActions.map(function (action) { return action.id; });
  var schema = {
    liveBufferSeconds: { defaultValue: 60, min: 60, max: 300, step: 30 },
    vodBufferSeconds: { defaultValue: 10, min: 5, max: 120, step: 5 },
    performanceMode: { defaultValue: "auto", values: ["auto", "speed", "quality"] },
    theme: { defaultValue: "noir", values: N.ThemeCatalog.map(function (theme) { return theme.id; }) },
    shortcutRed: { defaultValue: "continue", values: shortcutValues },
    shortcutGreen: { defaultValue: "settings", values: shortcutValues },
    shortcutYellow: { defaultValue: "favorite", values: shortcutValues },
    shortcutBlue: { defaultValue: "search", values: shortcutValues }
  };
  function normalize(key, value) {
    var definition = schema[key];
    if (!definition) return value;
    if (definition.values) {
      value = String(value || definition.defaultValue);
      return definition.values.indexOf(value) >= 0 ? value : definition.defaultValue;
    }
    value = Math.round(Number(value) || definition.defaultValue);
    return Math.max(definition.min, Math.min(definition.max, value));
  }
  function readAll() {
    var saved = N.read(storageKey, {}), values = {}, key;
    for (key in schema) if (Object.prototype.hasOwnProperty.call(schema, key)) {
      values[key] = normalize(key, saved[key]);
    }
    return values;
  }
  N.Settings = {
    schema: schema,
    getAll: readAll,
    get: function (key) {
      var values = readAll();
      return values[key];
    },
    set: function (key, value) {
      if (!schema[key]) return null;
      var saved = N.read(storageKey, {});
      saved[key] = normalize(key, value);
      N.write(storageKey, saved);
      return saved[key];
    },
    register: function (key, definition) {
      if (key && definition) schema[key] = definition;
    }
  };
  N.shortcutAction = function (color) {
    var id = N.Settings.get("shortcut" + color.charAt(0).toUpperCase() + color.slice(1)), i;
    for (i = 0; i < N.ShortcutActions.length; i += 1) if (N.ShortcutActions[i].id === id) return N.ShortcutActions[i];
    return N.ShortcutActions[0];
  };
  N.applyTheme = function () {
    var theme = N.Settings.get("theme");
    var color = "#07060B", i;
    for (i = 0; i < N.ThemeCatalog.length; i += 1) if (N.ThemeCatalog[i].id === theme) { color = N.ThemeCatalog[i].colors.background; break; }
    var meta = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
    document.documentElement.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", color);
  };
  N.applyPerformanceMode = function () {
    var selected = N.Settings.get("performanceMode"), effective = selected;
    if (selected === "auto") effective = typeof tizen !== "undefined" ? "speed" : "quality";
    document.documentElement.setAttribute("data-performance", effective);
    document.documentElement.setAttribute("data-performance-setting", selected);
    return effective;
  };
  N.applyTheme();
  N.applyPerformanceMode();
})(Noir);
