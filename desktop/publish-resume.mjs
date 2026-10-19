// Reprise d'upload : notice UTF-8 + SHA256SUMS.txt (idempotent).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const repo = "imadJHR/application-ironz";
const token = (() => {
  const out = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
  }).toString();
  return out.split("\n").find((l) => l.startsWith("password="))?.slice(9);
})();
const api = "https://api.github.com/repos/" + repo;
const H = () => ({
  Authorization: "Bearer " + token,
  Accept: "application/vnd.github+json",
  "User-Agent": "ironz-release-helper",
});
const rel = await (await fetch(api + "/releases/tags/v0.1.0", { headers: H() })).json();
const present = new Set((rel.assets ?? []).map((a) => a.name));
console.log("présents :", [...present].join(" | "));

const exe = path.resolve("desktop/dist/IRONZ-Gestion-Setup-0.1.0.exe");
const notice = path.resolve("distribution/IRONZ-Notice-Installation.txt");
const exeSha = createHash("sha256").update(fs.readFileSync(exe)).digest("hex").toUpperCase();
const noticeSha = createHash("sha256").update(fs.readFileSync(notice)).digest("hex").toUpperCase();
const sums = `${exeSha}  IRONZ-Gestion-Setup-0.1.0.exe\n${noticeSha}  IRONZ-Notice-Installation.txt\n`;

const toUpload = [];
if (!present.has("IRONZ-Notice-Installation.txt"))
  toUpload.push(["IRONZ-Notice-Installation.txt", fs.readFileSync(notice, "utf8")]);
if (!present.has("SHA256SUMS.txt"))
  toUpload.push(["SHA256SUMS.txt", Buffer.from(sums, "utf8")]);
if (!present.has("IRONZ-Gestion-Setup-0.1.0.exe"))
  toUpload.push(["IRONZ-Gestion-Setup-0.1.0.exe", fs.readFileSync(exe)]);

for (const [name, data] of toUpload) {
  const buf = Buffer.from(data, "utf8");
  const up = await fetch(
    `https://uploads.github.com/repos/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buf.length),
        "User-Agent": "ironz-release-helper",
      },
      body: buf,
    },
  );
  const j = await up.json();
  console.log("upload", name, up.status, j?.state ?? j?.message);
}
console.log("fin — assets attendus :", rel.assets?.length + toUpload.length);
