"use strict";
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CODE_PATTERN = /^\d{6}$/;
const TOKEN_PATTERN = /^[a-f0-9]{32,128}$/i;
const SESSION_SECONDS = 900;
const redisClient = KV_URL && KV_TOKEN ? new Redis({ url: KV_URL, token: KV_TOKEN }) : null;
const limiter = redisClient && process.env.DISABLE_RATE_LIMIT !== "1" ? new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(120, "1 m"), prefix: "cinema-noir:pair-limit", analytics: false }) : null;

function reply(res, status, value) {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(value);
}
async function redis(command) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV_NOT_CONFIGURED");
  const response = await fetch(KV_URL, { method: "POST", headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(command) });
  const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || "KV_ERROR"); return data.result;
}
function normalizeCode(value) { return String(value || "").trim(); }
function safeDevice(value) {
  value = value || {};
  const lists = Array.isArray(value.lists) ? value.lists.map(function (item) { return { id: String(item.id || "").slice(0, 80), name: String(item.name || "Lista").slice(0, 60) }; }).filter(function (item) { return item.id; }) : [];
  return { lists, activeId: String(value.activeId || "").slice(0, 80) };
}
function publicSession(session) { return { status: "connected", device: safeDevice(session.device), queued: (session.commands || []).length, events: (session.events || []).slice(-8), expiresIn: SESSION_SECONDS }; }
function normalizeList(value) {
  value = value || {};
  const name = String(value.name || "Minha lista").trim().slice(0, 60), baseUrl = "http://" + String(value.baseUrl || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""), username = String(value.username || "").trim(), password = String(value.password || "");
  if (!/^http:\/\/[^/\s]+/i.test(baseUrl) || !username || !password || baseUrl.length > 300 || username.length > 200 || password.length > 200) return null;
  return { name, baseUrl, username, password };
}
function clientIp(req) { return String(req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) || req.socket && req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
async function limited(req) { if (!limiter) return false; return !(await limiter.limit(clientIp(req))).success; }
async function readSession(code) { const raw = await redis(["GET", "pair:" + code]); return raw ? JSON.parse(raw) : null; }
async function writeSession(code, session, nx) { const command = ["SET", "pair:" + code, JSON.stringify(session), "EX", String(SESSION_SECONDS)]; if (nx) command.push("NX"); return redis(command); }
function newCommandId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return reply(res, 200, { ok: true });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}, code = normalizeCode(req.method === "GET" ? req.query && req.query.code : body.code), token = String(req.method === "GET" ? req.query && req.query.token || "" : body.token || "");
    if (!CODE_PATTERN.test(code)) return reply(res, 400, { error: "O código deve ter 6 números." });
    if (await limited(req)) return reply(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
    if (req.method === "GET") {
      const session = await readSession(code); if (!session) return reply(res, 404, { error: "Código inexistente ou expirado." });
      if (!token) return reply(res, 200, publicSession(session));
      if (!TOKEN_PATTERN.test(token) || session.token !== token) return reply(res, 403, { error: "TV não autorizada." });
      return reply(res, 200, { status: "connected", commands: session.commands || [] });
    }
    if (req.method !== "POST") return reply(res, 405, { error: "Método não permitido." });
    const action = String(body.action || "");
    if (action === "create") {
      if (!TOKEN_PATTERN.test(token)) return reply(res, 400, { error: "Token inválido." });
      const created = await writeSession(code, { token, createdAt: Date.now(), device: safeDevice(body.device), commands: [], events: [] }, true);
      if (!created) return reply(res, 409, { error: "Código em uso. Gere outro." });
      return reply(res, 201, { status: "connected", expiresIn: SESSION_SECONDS });
    }
    const session = await readSession(code); if (!session) return reply(res, 404, { error: "Código inexistente ou expirado." });
    session.commands = session.commands || []; session.events = session.events || [];
    if (action === "add" || action === "submit") {
      const list = normalizeList(body.list); if (!list) return reply(res, 400, { error: "Preencha corretamente servidor, usuário e senha." });
      session.commands.push({ id: newCommandId(), type: "add", list, createdAt: Date.now() }); await writeSession(code, session); return reply(res, 200, { status: "queued" });
    }
    if (action === "remove" || action === "activate") {
      const profileId = String(body.profileId || "").slice(0, 80);
      if (!profileId || !session.device || !session.device.lists.some(function (item) { return item.id === profileId; })) return reply(res, 400, { error: "Lista não encontrada nesta TV." });
      session.commands.push({ id: newCommandId(), type: action, profileId, createdAt: Date.now() }); await writeSession(code, session); return reply(res, 200, { status: "queued" });
    }
    if (action === "ack") {
      if (!TOKEN_PATTERN.test(token) || session.token !== token) return reply(res, 403, { error: "TV não autorizada." });
      const commandId = String(body.commandId || "");
      session.commands = session.commands.filter(function (item) { return item.id !== commandId; }); session.device = safeDevice(body.device);
      session.events.push({ id: commandId, status: body.status === "error" ? "error" : "success", message: String(body.message || "Comando concluído.").slice(0, 180), at: Date.now() }); session.events = session.events.slice(-8);
      await writeSession(code, session); return reply(res, 200, publicSession(session));
    }
    return reply(res, 400, { error: "Ação inválida." });
  } catch (error) {
    if (error.message === "KV_NOT_CONFIGURED") return reply(res, 503, { error: "Configure o banco KV na Vercel." });
    console.error("PAIR API ERROR", error); return reply(res, 500, { error: "Não foi possível concluir o pareamento." });
  }
};
