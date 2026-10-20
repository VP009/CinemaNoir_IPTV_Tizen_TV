"use strict";
module.exports = function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({
    version: process.env.APP_RELEASE_VERSION || "1.3.1",
    releasedAt: "2026-10-13",
    storeManaged: true,
    notes: ["App Tizen separado das funções de API", "Mini player AVPlay alinhado à camada nativa da TV", "Correções de vídeo e tamanho do viewport em diferentes resoluções"]
  });
};
