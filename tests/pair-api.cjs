const assert = require("assert");
process.env.KV_REST_API_URL = "https://kv.invalid";
process.env.KV_REST_API_TOKEN = "test-token";
process.env.DISABLE_RATE_LIMIT = "1";
const values = new Map();
global.fetch = async function (_url, options) {
  const command = JSON.parse(options.body), op = command[0], key = command[1]; let result = null;
  if (op === "SET") { if (command.includes("NX") && values.has(key)) result = null; else { values.set(key, command[2]); result = "OK"; } }
  if (op === "GET") result = values.has(key) ? values.get(key) : null;
  return { ok: true, async json() { return { result }; } };
};
const handler = require("../api/pair.js");
function call(method, body, query) {
  const result = { statusCode: 0, body: null, headers: {} };
  const response = { setHeader(k,v){ result.headers[k]=v; }, status(code){ result.statusCode=code; return this; }, json(value){ result.body=value; return result; } };
  return Promise.resolve(handler({ method, body: body || {}, query: query || {}, headers:{"x-forwarded-for":"127.0.0.1"} }, response)).then(() => result);
}
(async function () {
  const code = "123456", token = "a".repeat(48), device = { activeId:"p1", lists:[{id:"p1",name:"Sala"},{id:"p2",name:"Quarto"}] };
  assert.equal((await call("POST", { action:"create", code, token, device })).statusCode, 201);
  assert.equal((await call("POST", { action:"create", code, token, device })).statusCode, 409);
  const visible = await call("GET", null, { code });
  assert.equal(visible.body.status, "connected"); assert.equal(visible.body.device.lists.length, 2); assert.equal(visible.body.device.activeId, "p1");
  assert.equal((await call("POST", { action:"add", code, list:{ name:"Cozinha", baseUrl:"https://example.com/", username:"user", password:"pass" } })).body.status, "queued");
  const tv = await call("GET", null, { code, token }); assert.equal(tv.body.commands.length, 1); assert.equal(tv.body.commands[0].type, "add");
  const commandId = tv.body.commands[0].id, updated = { activeId:"p3", lists:device.lists.concat([{id:"p3",name:"Cozinha"}]) };
  const ack = await call("POST", { action:"ack", code, token, commandId, status:"success", message:"Lista adicionada.", device:updated });
  assert.equal(ack.body.device.lists.length, 3); assert.equal(ack.body.queued, 0); assert.equal(ack.body.events[0].status, "success");
  assert.equal((await call("POST", { action:"activate", code, profileId:"p2" })).body.status, "queued");
  assert.equal((await call("POST", { action:"remove", code, profileId:"missing" })).statusCode, 400);
  assert.equal((await call("POST", { action:"add", code:"ABC123", list:{} })).statusCode, 400);
  console.log("PASS: API numérica gerencia múltiplas listas com fila e confirmação da TV.");
}()).catch(function (error) { console.error(error); process.exit(1); });
