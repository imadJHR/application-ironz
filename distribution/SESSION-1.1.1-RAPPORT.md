# Rapport de session — 1.1.1

## Livrable
- `desktop/dist/IRONZ-Gestion-Setup-1.1.1.exe`
- Taille : **135,7 Mo** (142 334 766 octets)
- SHA-256 : `D3E3F65AA8FB7EB182447CFFCE09AD9E0B9401CA5E2885D627620B5000645D1C`
- Notice de livraison : `desktop/dist/IRONZ-Notice-Installation.txt` (version 1.1.1)

## Travail effectué (aucune fonctionnalité métier modifiée)
1. Bump version 1.1.1 dans `package.json`, `package-lock.json` (la racine du
   lock était restée en 1.0.0 — synchronisé), scripts de build (`pkg.version`
   lu automatiquement), `desktop/smoke.mjs` (libellés).
2. Métadonnées Windows/NSIS alimentées par la version du package :
   ProductVersion/FileVersion = **1.1.1 / 1.1.1.0** vérifiées sur l'exe
   win-unpacked ET sur l'exe installé.
3. Documentation : `distribution/CHANGELOG.md` (entrée 1.1.1 ajoutée,
   historique 1.1.0 conservé), `distribution/README.md` (table des
   livrables), `distribution/IRONZ-Notice-Installation.txt` (1.1.1).
4. Références 1.1.0 restantes = historiques uniquement (CHANGELOG,
   rapport de session 1.1.0, livrable 1.1.0 conservé dans `desktop/dist/`).
   Aucune référence à 1.1.0 dans les métadonnées, le code source ou l'UI.

## Tests exécutés (sur le build 1.1.1 final)
| Vérification | Résultat |
| --- | --- |
| TypeScript typecheck | OK (label npm : ironz-gestion@1.1.1) |
| ESLint | OK |
| Tests unitaires | 9/9 OK |
| Smoke 18 étapes (win-unpacked) | **TOUT PASSE** : setup-first, refus mots de passe non concordants, setup non rejouable, refus mauvais mot de passe, connexion (cookie httpOnly), client créé/modifié (Rabat persistée), devis 1 200 TTC, PDF 23 511 octets, recherche, mot de passe absent en clair de la base, sauvegarde (signature SQLite), refus fichier bidon, restauration + reconnexion + écriture post-restauration |
| First Run Setup | OK (aucun identifiant par défaut, template vierge) |
| SQLite / offline | OK (serveur local 127.0.0.1:4380, aucune ressource externe) |
| Backup & Restore | OK (inchangés, validés dans le smoke) |
| Migration 1.0.0 → 1.1.1 | OK (base réelle 1.0.0 : pas de setup, login ancien compte, données conservées) |
| Installation NSIS per-user silencieuse | OK (interfaces Bureau + raccourcis inchangées) |
| Via le raccourci installé : version 1.1.1, login base existante | OK |
| Désinstallation | OK (exe retiré, `ironz.db` préservé) |
| Logo officiel IRONZ | OK (icon.ico 7 tailles + ironz-logo.png dans la bundle) |
| Template embarqué sans identifiants ni données de test | OK (users=0, clients=0, produits=0, documents=0, settings=0) |
| Bases existantes conservées à la migration 1.0.0 et à la désinstallation | OK |

## Problèmes restants
- Accents du `desktop/smoke.mjs` écrasés par un one-liner PowerShell —
  réécrits intégralement (fichier sain vérifié par le smoke).
- Installeur toujours non signé (documenté dans la notice §1) — décision
  de signature de code remise au propriétaire du projet.
- La 1.1.0 exe/blockmap restent dans `desktop/dist/` (historique ; à
  retirer au moment d'une éventuelle publication si non souhaité).

## État Git au terme de la validation
- Point de sauvegarde 1.0.0 : commit `c7a32b5`, tag `v1.0.0-desktop`.
- Modifiés : `desktop/build.mjs`, `desktop/smoke.mjs`, `package.json`,
  `package-lock.json`, `src/app/(gestion)/parametres/page.tsx`,
  `src/app/connexion/page.tsx`, `src/server/actions.ts`,
  `src/server/password.ts`, `src/server/validation.ts`.
- Nouveaux : `distribution/` (README, CHANGELOG, notice, rapport 1.1.0,
  rapport 1.1.1), `src/app/api/system/`, `src/app/premiere-installation/`,
  `src/components/backup-restore.tsx`, `src/components/first-run-form.tsx`,
  `src/server/backup.ts`.
- Supprimé : `desktop/seed.ts` (+ `desktop/.env.desktop` gitignored).
- **Aucun commit ni push** demandés ni réalisés ; GitHub Release non
  publiée (en attente d'autorisation).