// Sauvegarde locale des assets actuels de la Release v0.1.0
// avant remplacement par la nouvelle version 0.1.0.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

function token() {
  const out = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
  }).toString();
  return out.split("\n").find((l) => l.startsWith("password="))?.slice(9);
}
const t = token();
const api = "https://api.github.com/repos/imadJHR/application-ironz";
const H = () => ({
  Authorization: "Bearer " + t,
  Accept: "application/vnd.github+json",
  "User-Agent": "ironz-release-helper",
});
const release = (await (await fetch(api + "/releases/tags/v0.1.0", { headers: H() })).json()).data
  ? null : null;
const res = await fetch(api + "/releases/tags/v0.1.0", { headers: H() });
const rel = await res.json();
if (!rel?.assets) {
  console.log("release absente :", rel?.message || res.status);
  process.exit(1);
}
const dir = "C:/Users/imadj/AppData/Local/Temp/opencode/release-v010-sauvegarde";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "release-meta.json"),
  JSON.stringify({ id: rel.id, tag_name: rel.tag_name, name: rel.name, body: rel.body, draft: rel.draft, prerelease: rel.prerelease }, null, 2),
  "utf8",
);
for (const a of rel.assets) {
  const buf = Buffer.from(
    await (await fetch(a.url, { headers: { ...H(), Accept: "application/octet-stream" } })).arrayBuffer(),
  );
  const dest = path.join(dir, a.name);
  fs.writeFileSync(dest, buf);
  const sha = createHash("sha256").update(buf).digest("hex").toUpperCase();
  console.log(a.name, buf.length, a.state || "", "sha256=" + sha);
  if (buf.length !== a.size) console.log("!! taille attendue " + a.size);
}
console.log("SAUVEGARDE OK :", dir);
