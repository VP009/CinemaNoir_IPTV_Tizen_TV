"use strict";
module.exports = function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({
    version: process.env.APP_RELEASE_VERSION || "1.2.0",
    releasedAt: "2026-10-11",
    storeManaged: true,
    notes: ["Modo de máxima fluidez para Tizen", "Imagens e EPG pausados durante a navegação", "Busca pré-indexada e catálogo virtual ampliado", "Mini player e cache com menor uso de CPU"]
  });
};
