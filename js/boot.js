(function () {
	"use strict";
	window.onerror = function (message, source, line, column) {
		var debug = document.getElementById("debug-error");
		if (!debug) {
			debug = document.createElement("div");
			debug.id = "debug-error";
			debug.style.cssText = "position:fixed;left:20px;bottom:20px;max-width:1500px;background:#7f1d1d;color:#fff;padding:18px;font-size:22px;z-index:999999";
			document.body.appendChild(debug);
		}
		debug.innerHTML = "ERRO: " + message + "<br>ARQUIVO: " + source + "<br>LINHA: " + line + "<br>COLUNA: " + column;
		return false;
	};
	if (typeof Noir === "undefined") window.Noir = {};
	Noir.started = false;
	function startApplication() {
		try {
			if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
				["MediaPlay", "MediaPause", "MediaFastForward", "MediaRewind", "MediaStop"].forEach(function (key) {
					try {
						tizen.tvinputdevice.registerKey(key);
					} catch (error) {
						console.log("KEY REGISTRATION ERROR", key, error);
					}
				});
			}
			if (Noir.initRemoteKeys) Noir.initRemoteKeys();
			var active = Noir.read("active", null);
			if (active) Noir.activate(active);
			if (!location.hash) location.hash = Noir.active ? "#/home" : "#/login";
			Noir.started = true;
			Noir.render();
		} catch (error) {
			Noir.fail(error.message || String(error));
		}
	}
	window.addEventListener("load", startApplication);
}());
