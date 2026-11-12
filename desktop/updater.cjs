const { createHash, randomUUID } = require("node:crypto");
const { createReadStream, createWriteStream } = require("node:fs");
const { lstat, mkdir, readdir, rename, rm } = require("node:fs/promises");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const REPO = "imadJHR/application-ironz";
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_HOSTS = new Set([
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const INSTALLER = /^IRONZ-Gestion-Setup-(\d+\.\d+\.\d+)\.exe$/;
const MAX_SIZE = 512 * 1024 * 1024;

function isNewer(version, currentVersion) {
  if (!VERSION.test(version) || !VERSION.test(currentVersion)) return false;
  const current = currentVersion.split(".").map(Number);
  const next = version.split(".").map(Number);
  const differing = next.findIndex((value, index) => value !== current[index]);
  return differing !== -1 && next[differing] > current[differing];
}

async function fileMatches(file, asset) {
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.size !== asset.size) return false;
  const hash = createHash("sha256");
  let first = true;
  for await (const bytes of createReadStream(file)) {
    if (first && bytes.subarray(0, 2).toString("ascii") !== "MZ") return false;
    first = false;
    hash.update(bytes);
  }
  return hash.digest("hex") === asset.sha256;
}

function createUpdater({
  currentVersion,
  directory,
  launch,
  fetchUpdate = fetch,
}) {
  let prepared;
  let busy = false;

  async function findAsset(version) {
    if (typeof version !== "string" || !isNewer(version, currentVersion))
      throw new Error("Version de mise à jour invalide.");
    const response = await fetchUpdate(LATEST, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "IRONZ-Gestion",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error("La release officielle est indisponible.");
    const release = await response.json();
    const tag = "v" + version;
    if (
      release.tag_name !== tag ||
      release.draft !== false ||
      release.prerelease !== false
    )
      throw new Error(
        "La version a changé. Recherchez les mises à jour à nouveau.",
      );
    const name = `IRONZ-Gestion-Setup-${version}.exe`;
    const url = `https://github.com/${REPO}/releases/download/${tag}/${name}`;
    const asset =
      Array.isArray(release.assets) &&
      release.assets.find((item) => item?.name === name);
    if (
      !asset ||
      asset.state !== "uploaded" ||
      asset.browser_download_url !== url ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 2 ||
      asset.size > MAX_SIZE ||
      typeof asset.digest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/i.test(asset.digest)
    )
      throw new Error("L’installateur officiel ne peut pas être vérifié.");
    return {
      name,
      url,
      size: asset.size,
      sha256: asset.digest.slice(7).toLowerCase(),
    };
  }

  async function openInstaller(url, signal) {
    let location = new URL(url);
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetchUpdate(location, {
        redirect: "manual",
        signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.ok || !response.body)
          throw new Error("Le téléchargement de l’installateur a échoué.");
        return response.body;
      }
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next) throw new Error("Redirection de téléchargement invalide.");
      location = new URL(next, location);
      if (
        location.protocol !== "https:" ||
        !ASSET_HOSTS.has(location.host) ||
        location.username ||
        location.password
      )
        throw new Error("Adresse de téléchargement non autorisée.");
    }
    throw new Error("Trop de redirections pendant le téléchargement.");
  }

  async function download(version, onProgress = () => {}) {
    if (busy) throw new Error("Une mise à jour est déjà en cours.");
    busy = true;
    prepared = undefined;
    let partial;
    try {
      const asset = await findAsset(version);
      await mkdir(directory, { recursive: true });
      if (!(await lstat(directory)).isDirectory())
        throw new Error("Le dossier de mise à jour est invalide.");
      const file = path.join(directory, asset.name);
      if (!(await fileMatches(file, asset))) {
        await rm(file, { force: true });
        partial = file + "." + randomUUID() + ".part";
        const signal = AbortSignal.timeout(15 * 60 * 1000);
        const body = await openInstaller(asset.url, signal);
        let received = 0;
        let lastPercent = 0;
        const verify = new Transform({
          transform(chunk, _encoding, callback) {
            received += chunk.length;
            if (received > asset.size)
              return callback(
                new Error("Taille de téléchargement inattendue."),
              );
            const percent = Math.min(
              99,
              Math.floor((received * 100) / asset.size),
            );
            if (percent !== lastPercent) {
              lastPercent = percent;
              onProgress(percent);
            }
            callback(null, chunk);
          },
        });
        await pipeline(
          Readable.fromWeb(body),
          verify,
          createWriteStream(partial, { flags: "wx" }),
          { signal },
        );
        if (received !== asset.size || !(await fileMatches(partial, asset)))
          throw new Error(
            "Le téléchargement ne correspond pas à l’installateur officiel.",
          );
        await rename(partial, file);
      }
      prepared = { version, file, asset };
      onProgress(100);
    } finally {
      if (partial) await rm(partial, { force: true }).catch(() => {});
      busy = false;
    }
  }

  async function install(version, confirm) {
    if (busy) throw new Error("Une mise à jour est déjà en cours.");
    if (!prepared || version !== prepared.version)
      throw new Error("Téléchargez la mise à jour avant de l’installer.");
    busy = true;
    try {
      if (!(await confirm(version))) return false;
      if (!(await fileMatches(prepared.file, prepared.asset))) {
        prepared = undefined;
        throw new Error(
          "Le fichier a changé. Téléchargez à nouveau la mise à jour.",
        );
      }
      await launch(prepared.file);
      prepared = undefined;
      return true;
    } finally {
      busy = false;
    }
  }

  async function cleanup() {
    const info = await lstat(directory).catch(() => null);
    if (!info?.isDirectory()) return;
    const files = await readdir(directory).catch(() => []);
    await Promise.allSettled(
      files.flatMap((name) => {
        const match = INSTALLER.exec(name);
        return match && !isNewer(match[1], currentVersion)
          ? [rm(path.join(directory, name), { force: true })]
          : [];
      }),
    );
  }

  return { download, install, cleanup };
}

module.exports = { createUpdater };
