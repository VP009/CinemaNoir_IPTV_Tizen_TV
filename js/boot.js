(function () {
	"use strict";
	window.onerror = function (message, source, line, column) {
		var debug = document.getElementById("debug-error");
		if (!debug) {
			debug = document.createElement("div");
			debug.id = "debug-error";
			debug.className = "debug-error";
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
				document.documentElement.classList.add("tizen-device");
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
