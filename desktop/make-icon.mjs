// Genere une icone Windows .ico multi-tailles depuis le logo officiel IRONZ.
// Usage : node desktop/make-icon.mjs "<chemin-logo.png>" "desktop/icon.ico"
// Aucune creation de logo : on part du fichier fourni (>= 256x256 de prefere).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const src = process.argv[2];
const out = process.argv[3] || "desktop/icon.ico";
if (!src) throw new Error("Chemin du logo manquant.");

const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = [];
for (const size of sizes) {
  const buf = await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  frames.push({ size, buf });
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);

const entries = Buffer.alloc(16 * frames.length);
let offset = 6 + 16 * frames.length;
frames.forEach((frame, index) => {
  const at = index * 16;
  const dim = frame.size >= 256 ? 0 : frame.size;
  entries.writeUInt8(dim, at + 0);
  entries.writeUInt8(dim, at + 1);
  entries.writeUInt8(0, at + 2);
  entries.writeUInt8(0, at + 3);
  entries.writeUInt16LE(1, at + 4);
  entries.writeUInt16LE(32, at + 6);
  entries.writeUInt32LE(frame.buf.length, at + 8);
  entries.writeUInt32LE(offset, at + 12);
  offset += frame.buf.length;
});

writeFileSync(out, Buffer.concat([header, entries, ...frames.map((f) => f.buf)]));
console.log("Icone generee : " + out + " (" + frames.length + " tailles)");