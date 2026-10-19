import "server-only";
import pkg from "../../package.json";

// Vérification des mises à jour (section Paramètres ▸ Mises à jour).
// Principe : un simple GET public vers l'API GitHub du dépôt officiel,
// sans jamais transmettre de données locales. L'application n'exécute
// jamais un installateur : le bouton télécharge s'ouvre dans le
// navigateur, l'installation reste manuelle.

export const CURRENT_VERSION: string = pkg.version;
// Dépôt officiel : seule source acceptée pour les liens proposés.
export const OFFICIAL_REPO_PATH = "/imadJHR/application-ironz";
export const OFFICIAL_RELEASES_PAGE =
  "https://github.com" + OFFICIAL_REPO_PATH + "/releases/latest";
// Réservé aux tests (servesurs de test locaux) : override de l'URL de
// l'API. En production cet environnement n'est jamais défini.
export const RELEASES_URL =
  process.env.IRONZ_RELEASES_URL ||
  "https://api.github.com/repos" + OFFICIAL_REPO_PATH + "/releases/latest";

const TIMEOUT_MS = 6000;
const NOTES_MAX = 4000;

export type UpdateInfo =
  | {
      status: "current";
      currentVersion: string;
      latestVersion: string;
      publishedAt: string | null;
    }
  | {
      status: "available";
      currentVersion: string;
      latestVersion: string;
      publishedAt: string | null;
      notes: string;
      downloadUrl: string;
      pageUrl: string;
    }
  | { status: "offline"; currentVersion: string; message: string }
  | { status: "error"; currentVersion: string; message: string };

const OFFLINE_MESSAGE = "Connexion Internet indisponible.";
const LIBELLE = "version";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function checkForUpdatesRaw(): Promise<
  { kind: "payload"; payload: unknown } | { kind: "offline" } | { kind: "error" }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(RELEASES_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent":
          "IRONZ-Gestion/" + CURRENT_VERSION + " (mise-a-jour; aucune donnee)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    // Timeout, réseau coupé, DNS indisponible : état hors ligne.
    clearTimeout(timer);
    return { kind: "offline" };
  }
  clearTimeout(timer);
  try {
    if (res.status === 404) {
      // Aucune version publiée : l'installation est la plus récente.
      return { kind: "payload", payload: { tag_name: null } };
    }
    if (res.status === 403 || res.status === 429)
      return { kind: "error" };
    if (!res.ok) return { kind: "error" };
    return { kind: "payload", payload: await res.json() };
  } catch {
    // Réponse reçue mais illisible (corps non JSON tronqué…).
    return { kind: "error" };
  }
}

// "v0.1.2", "0.1.3", "0.2.0-beta" → [0,1,2] ; invalide → null.
export function parseVersionTag(tag: unknown): number[] | null {
  if (typeof tag !== "string") return null;
  const match = tag.match(/^v?(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?/);
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2] || "0"),
    Number(match[3] || "0"),
  ];
}

export function compareVersions(
  a: number[],
  b: number[],
): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

// Lien accepté uniquement si https + github.com + dépôt officiel.
export function safeOfficialUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500)
    return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.host !== "github.com" && url.host !== "www.github.com") return null;
  const path = url.pathname;
  if (
    !path.startsWith(OFFICIAL_REPO_PATH + "/releases/download/") &&
    !path.startsWith(OFFICIAL_REPO_PATH + "/releases/tag/")
  )
    return null;
  // Lien direct installateur : reconstitué depuis le chemin validé.
  return "https://github.com" + path;
}

export function safeAssetDownloadUrl(payload: Record<string, unknown>): string | null {
  const assets = payload.assets;
  if (!Array.isArray(assets)) return null;
  for (const asset of assets as unknown[]) {
    if (!isRecord(asset)) continue;
    const name = typeof asset.name === "string" ? asset.name : "";
    if (!/^IRONZ-Gestion-Setup-.*\.exe$/i.test(name)) continue;
    const url = safeOfficialUrl(asset.browser_download_url);
    if (url) return url;
  }
  return null;
}

export function sanitizeNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .slice(0, NOTES_MAX)
    .trim();
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const result = await checkForUpdatesRaw();
  if (result.kind === "offline")
    return {
      status: "offline",
      currentVersion: CURRENT_VERSION,
      message: OFFLINE_MESSAGE,
    };
  if (result.kind === "error")
    return {
      status: "error",
      currentVersion: CURRENT_VERSION,
      message:
        "Vérification impossible pour le moment (source de mises à jour " +
        "temporairement indisponible). Réessayez plus tard.",
    };
  const payload = result.payload;
  if (!isRecord(payload))
    return {
      status: "error",
      currentVersion: CURRENT_VERSION,
      message: "Impossible de lire les informations de version.",
    };
  if (payload.tag_name === null || payload.tag_name === undefined) {
    // Dépôt sans version publiée : installation considérée à jour.
    return {
      status: "current",
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      publishedAt: null,
    };
  }
  const latest = parseVersionTag(payload.tag_name);
  if (!latest)
    return {
      status: "error",
      currentVersion: CURRENT_VERSION,
      message: "Impossible de lire les informations de " + LIBELLE + ".",
    };
  const current = parseVersionTag("v" + CURRENT_VERSION);
  const comparison = compareVersions(latest, current || [0, 0, 0]);
  const publishedAt =
    typeof payload.published_at === "string" ? payload.published_at : null;
  if (comparison <= 0)
    return {
      status: "current",
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      publishedAt,
    };
  // Nouvelle version : le lien est unique et dérive d'une URL validée
  // (release officielle). Sinon, page officielle de releases only.
  const downloadUrl = safeAssetDownloadUrl(payload);
  const pageUrl = safeOfficialUrl(payload.html_url) || OFFICIAL_RELEASES_PAGE;
  return {
    status: "available",
    currentVersion: CURRENT_VERSION,
    latestVersion: latest.join("."),
    publishedAt,
    notes: sanitizeNotes(payload.body),
    downloadUrl: downloadUrl || OFFICIAL_RELEASES_PAGE,
    pageUrl,
  };
}
