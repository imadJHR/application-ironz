const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  mkdtemp,
  readFile,
  readdir,
  rm,
  rmdir,
  writeFile,
} = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createUpdater } = require("./updater.cjs");

const version = "0.1.3";
const name = `IRONZ-Gestion-Setup-${version}.exe`;
const official = `https://github.com/imadJHR/application-ironz/releases/download/v${version}/${name}`;
const blob = "https://release-assets.githubusercontent.com/synthetic-fixture";
const bytes = Buffer.from("MZ synthetic test data");
const digest = "sha256:" + createHash("sha256").update(bytes).digest("hex");

async function fixture(
  t,
  { asset = {}, redirect = blob, payload = bytes, launch } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "ironz-updater-test-"));
  t.after(async () => {
    for (const file of await readdir(directory))
      await rm(join(directory, file));
    await rmdir(directory);
  });
  const requests = [];
  const launches = [];
  const updater = createUpdater({
    currentVersion: "0.1.2",
    directory,
    launch:
      launch ||
      (async (file) => {
        launches.push(file);
      }),
    async fetchUpdate(input) {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("https://api.github.com/"))
        return Response.json({
          tag_name: "v" + version,
          draft: false,
          prerelease: false,
          assets: [
            {
              name,
              browser_download_url: official,
              state: "uploaded",
              size: bytes.length,
              digest,
              ...asset,
            },
          ],
        });
      if (url === official) return Response.redirect(redirect);
      if (url === blob) return new Response(payload);
      throw new Error("Unexpected request " + url);
    },
  });
  return { updater, directory, requests, launches };
}

test("official asset is downloaded, reused and launched only after confirmation", async (t) => {
  const { updater, directory, requests, launches } = await fixture(t);
  const progress = [];
  await updater.download(version, (percent) => progress.push(percent));
  assert.equal(progress.at(-1), 100);
  assert.deepEqual(await readFile(join(directory, name)), bytes);
  assert.equal(await updater.install(version, async () => false), false);
  assert.equal(launches.length, 0);
  await updater.download(version);
  assert.equal(requests.filter((url) => url === blob).length, 1);
  assert.equal(await updater.install(version, async () => true), true);
  assert.deepEqual(launches, [join(directory, name)]);
  await assert.rejects(
    updater.install(version, async () => true),
    /Téléchargez/,
  );
});

test("downgrades and unverified or redirected installers are refused", async (t) => {
  const { updater, requests } = await fixture(t, { asset: { digest: null } });
  await assert.rejects(updater.download("0.1.1"), /invalide/);
  assert.equal(requests.length, 0);
  await assert.rejects(updater.download(version), /vérifié/);
  assert.equal(requests.length, 1);
  const redirected = await fixture(t, {
    redirect: "https://untrusted.example/installer.exe",
  });
  await assert.rejects(redirected.updater.download(version), /non autorisée/);
  assert.equal(redirected.requests.length, 2);
});

test("wrong bytes are discarded and changes after download prevent installation", async (t) => {
  const rejected = await fixture(t, { payload: Buffer.alloc(bytes.length) });
  await assert.rejects(rejected.updater.download(version), /ne correspond pas/);
  assert.deepEqual(await readdir(rejected.directory), []);
  const { updater, directory, launches } = await fixture(t);
  await updater.download(version);
  await writeFile(join(directory, name), Buffer.alloc(bytes.length));
  await assert.rejects(
    updater.install(version, async () => true),
    /a changé/,
  );
  assert.equal(launches.length, 0);
  await updater.download(version);
  assert.equal(await updater.install(version, async () => true), true);
});
