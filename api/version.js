"use strict";
module.exports = function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({
    version: process.env.APP_RELEASE_VERSION || "1.1.2",
    releasedAt: "2026-10-11",
    storeManaged: true,
    notes: ["Correção da imagem no mini player da TV ao vivo", "Correção do scroll em catálogos virtualizados", "Navegação otimizada", "Cache local e limpeza automática"]
  });
};
