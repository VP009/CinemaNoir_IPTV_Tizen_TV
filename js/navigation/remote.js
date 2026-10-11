(function (N) {
  "use strict";
  var pressed = false,
    longDone = false,
    timer,
    origin,
    seekHold = null,
    navigationTimes = [],
    fastNavigationTimer = null,
    navigationTimer = null,
    pendingNavigationCode = 0,
    lastNavigationAt = 0;
  N.redCode = 403;
  N.greenCode = 404;
  N.yellowCode = 405;
  N.blueCode = 406;
  N.initRemoteKeys = function () {
    if (typeof tizen === "undefined" || !tizen.tvinputdevice) return;
    try {
      tizen.tvinputdevice.registerKey("ColorF0Red");
      tizen.tvinputdevice.registerKey("ColorF1Green");
      tizen.tvinputdevice.registerKey("ColorF2Yellow");
      tizen.tvinputdevice.registerKey("ColorF3Blue");
      var red = tizen.tvinputdevice.getKey("ColorF0Red");
      var green = tizen.tvinputdevice.getKey("ColorF1Green");
      var yellow = tizen.tvinputdevice.getKey("ColorF2Yellow");
      var blue = tizen.tvinputdevice.getKey("ColorF3Blue");
      if (red) N.redCode = red.code;
      if (green) N.greenCode = green.code;
      if (yellow) N.yellowCode = yellow.code;
      if (blue) N.blueCode = blue.code;
    } catch (error) {
      console.log("REMOTE COLOR KEY ERROR", error);
    }
  };
  function favoriteShortcut(el) {
    if (el && el._favorite) el._favorite();
  }
  function searchShortcut() {
    var input = document.querySelector('[data-search-input="true"]');
    if (input && N.openKeyboard) {
      N.rememberFocus();
      N.focus(input);
      N.openKeyboard(input);
    } else if (N.shortcutRoute) {
      N.shortcutRoute("search");
    }
  }
  function runColorShortcut(color, el) {
    var action = N.shortcutAction ? N.shortcutAction(color).id : ({ red: "continue", green: "settings", yellow: "favorite", blue: "search" })[color];
    if (action === "favorite") {
      if (el && el._favorite) favoriteShortcut(el);
      else if (N.toast) N.toast("Selecione um canal, filme ou série para favoritar.");
    } else if (action === "search") searchShortcut();
    else if (N.shortcutRoute) N.shortcutRoute(action);
  }
  function resetSeekHold(commit) {
    if (seekHold && seekHold.timer) {
      clearInterval(seekHold.timer);
    }
    if (seekHold && commit && N.playerScrubCommit) N.playerScrubCommit();
    else if (seekHold && N.playerScrubCancel) N.playerScrubCancel();
    seekHold = null;
  }
  function markNavigationSpeed() {
    var now = Date.now(), recent = [], i;
    for (i = 0; i < navigationTimes.length; i += 1) if (now - navigationTimes[i] < 220) recent.push(navigationTimes[i]);
    recent.push(now);
    navigationTimes = recent;
    if (recent.length >= 3) document.documentElement.classList.add("fast-navigation");
    clearTimeout(fastNavigationTimer);
    fastNavigationTimer = setTimeout(function () {
      document.documentElement.classList.remove("fast-navigation");
      navigationTimes = [];
    }, 130);
  }
  function flushNavigation() {
    var code = pendingNavigationCode;
    navigationTimer = null;
    pendingNavigationCode = 0;
    if (!code) return;
    lastNavigationAt = Date.now();
    N.moveFocus(code);
  }
  function scheduleNavigation(code) {
    var isTizen = typeof tizen !== "undefined", elapsed, delay;
    if (!isTizen) { N.moveFocus(code); return; }
    pendingNavigationCode = code;
    if (navigationTimer) return;
    elapsed = Date.now() - lastNavigationAt;
    delay = Math.max(0, 30 - elapsed);
    if (!delay) flushNavigation();
    else navigationTimer = setTimeout(flushNavigation, delay);
  }
  N.RemoteNavigation = window.RemoteNavigation = { init: function () { N.initRemoteKeys(); } };
  N.cancelPress = function () {
    clearTimeout(timer);
    if (navigationTimer) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(navigationTimer);
      clearTimeout(navigationTimer);
    }
    navigationTimer = null;
    pendingNavigationCode = 0;
    pressed = false;
    longDone = false;
    origin = null;
    resetSeekHold();
  };
  document.addEventListener("keydown", function (e) {
    var code = e.keyCode || ({ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40, Enter:13, Escape:27})[e.key],
      el = N.getFocused();
    if (N.playerActive) N.playerActivity();
    var color = code === N.redCode ? "red" : code === N.greenCode ? "green" : code === N.yellowCode ? "yellow" : code === N.blueCode ? "blue" : "";
    if (color && !document.querySelector(".tv-modal,.keyboard") && !N.playerActive) {
      e.preventDefault();
      runColorShortcut(color, el);
      return;
    }
    if (
      code === 10009 ||
      code === 27 ||
      (code === 8 && (!el || el.tagName !== "INPUT"))
    ) {
      e.preventDefault();
      N.cancelPress();
      N.back();
      return;
    }
    if (code >= 37 && code <= 40) {
      e.preventDefault();
      markNavigationSpeed();
      if (
        el &&
        el.dataset.action === "timeline" &&
        (code === 37 || code === 39) &&
        N.playerSeek
      ) {
        var direction = code === 37 ? -1 : 1;
        if (seekHold && seekHold.direction !== direction) {
          resetSeekHold(true);
        }
        if (!seekHold) {
          seekHold = { direction: direction, count: 0, timer: null };
          if (N.playerScrubStart && N.playerScrubStart(direction)) {
            function tickSeek() {
              if (!seekHold) return;
              seekHold.count += 1;
              var step = seekHold.count < 8 ? 2 : seekHold.count < 20 ? 5 : 10;
              N.playerScrubBy(direction * step);
            }
            seekHold.timer = setInterval(tickSeek, 80);
          } else {
            seekHold.count += 1;
            N.playerSeek(direction * 10);
          }
        }
        return;
      }
      scheduleNavigation(code);
      return;
    }
    if (code !== 13) return;
    e.preventDefault();
    if (pressed || e.repeat) return;
    pressed = true;
    origin = el;
    longDone = false;
    if (el && el._favorite)
      timer = setTimeout(function () {
        if (origin === N.getFocused()) {
          longDone = true;
          el._favorite();
        }
      }, 800);
  });
  document.addEventListener("keyup", function (e) {
    var code = e.keyCode || ({ArrowLeft:37, ArrowRight:39})[e.key];
    if (code === 37 || code === 39) {
      resetSeekHold(true);
      return;
    }
    if (e.keyCode !== 13 || !pressed) return;
    e.preventDefault();
    var target = origin,
      activate = !longDone && target === N.getFocused();
    N.cancelPress();
    if (activate && target) target.click();
  });
  window.addEventListener("blur", N.cancelPress);
  document.addEventListener("visibilitychange", N.cancelPress);
})(Noir);
