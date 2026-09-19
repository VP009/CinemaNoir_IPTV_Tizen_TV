"use strict";
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "pair", "index.html");
const output = path.join(root, "public", "index.html");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(source, output);
console.log("Gerenciador móvel criado em public/index.html");
