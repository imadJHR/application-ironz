// Vérification publique finale : release, assets, SHA, absence 0.1.1/0.1.2.
import fs from "node:fs";
import { createHash } from "node:crypto";

const repo = "imadJHR/application-ironz";
const UA = { "User-Agent": "ironz-verify" };

const latest = await (
  await fetch("https://api.github.com/repos/" + repo + "/releases/latest", { headers: UA })
).json();
console.log("latest :", latest.tag_name, "| assets:", (latest.assets ?? []).length);
for (const a of latest.assets) console.log(" -", a.name, a.size, "o", "état", a.state);

const exeUrl =
  "https://github.com/" + repo + "/releases/download/v0.1.0/IRONZ-Gestion-Setup-0.1.0.exe";
const exeBuf = Buffer.from(await (await fetch(exeUrl, { headers: UA })).arrayBuffer());
const exeSha = createHash("sha256").update(exeBuf).digest("hex").toUpperCase();
console.log(
  "EXE public :", exeBuf.length, "o, sha",
  exeSha === "760F7528FB16D25AC7DDB358BE299F68CC79ECDA23F5CFDFE0E3603DC19DD97E"
    ? "CONFORME (760F7528…)"
    : "!! DIFFÉRENT " + exeSha,
);

const noticeUrl =
  "https://github.com/" + repo + "/releases/download/v0.1.0/IRONZ-Notice-Installation.txt";
const noticeBuf = Buffer.from(await (await fetch(noticeUrl, { headers: UA })).arrayBuffer());
const local = fs.readFileSync("distribution/IRONZ-Notice-Installation.txt", "utf8");
console.log(
  "notice publique =", noticeBuf.length, "o,",
  noticeBuf.toString("utf8") === local ? "IDENTIQUE au dépôt" : "!! diffère",
);

const sumsUrl = "https://github.com/" + repo + "/releases/download/v0.1.0/SHA256SUMS.txt";
const sums = await (await fetch(sumsUrl, { headers: UA })).text();
console.log("SHA256SUMS.txt :", JSON.stringify(sums));

const all = await (await fetch("https://api.github.com/repos/" + repo + "/releases", { headers: UA })).json();
console.log(
  "releases publiques :", all.map((r) => r.tag_name).join(" "),
  "-> aucune 0.1.1/0.1.2 :",
  !all.some((r) => /0\.1\.[12]/.test(r.tag_name)),
);
const tag = await (await fetch("https://api.github.com/repos/" + repo + "/git/ref/tags/v0.1.0", { headers: UA })).json();
console.log("tag v0.1.0 objet :", tag.object?.sha);
