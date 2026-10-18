# Rapport de session — 1.1.0

## Livrable
- `desktop/dist/IRONZ-Gestion-Setup-1.1.0.exe` — **135,7 Mo**
- SHA-256 : `C7FAFF597A6C857E4F0F074805D72FA6CAFFA7227501C10EBEB2D4DF8F9A87DD`
- Référence 1.0.0 (SHA `60707AF2138EC43DEE32D17553199073A6922DABF69D1A1D96FF2805AF310275`,
  135,9 Mo) conservée dans `desktop/dist/`.
- Temps de construction complet : ≈ 7 minutes (identique à la 1.0.0 ;
  l'écriture de l'exe Electron de 247 Mo reste le plancher).

## Travail effectué
1. Point de restauration Git : commit `c7a32b5`, tag `v1.0.0-desktop`.
2. Chiffrement des mots de passe versionné (`s2` + scrypt N=2^15, OWASP),
   rétro-compatible 1.0.0 — vérifié sur une base réelle (ancien hash
   vérifié, mauvais mot de passe refusé, nouveau format auto-vérifié).
3. Suppression du seed desktop + `desktop/.env.desktop` ; template SQLite
   100 % vierge.
4. Configuration initiale (`/premiere-installation`) + redirection
   `/connexion` — atomique, non rejouable.
5. Sauvegarde et restauration (API admin + interface Paramètres) avec
   contrôles d'intégrité, sécurité de conservation, post-vérification et
   gestion du verrou Windows.
6. Smokes réécrits et exécutés, build répété, installeur validé.

## Problèmes rencontrés et résolus
- `redirect()` Next avalé par un `try/catch` (traitement : hors du try).
- Action serveur attendait un objet plat, mais `useActionState` passe
  `(état, FormData)` — corrigé.
- React 19 réinitialise les champs non contrôlés après une action : le
  smoke re-remplit tout avant une nouvelle soumission.
- Verrou Windows sur le fichier SQLite (EBUSY) : `$disconnect` + attentes
  contrôlées + fallback copie en place + post-vérification avec retour
  automatique.

## Tests
| N° | Test | Résultat |
| --- | --- | --- |
| 1-2 | Installation silencieuse 1.1.0, chemins NSIS per-user | OK |
| 3 | App installée : setup-first + API protégées (401/403) | OK |
| 4-5 | Connexion, refus mauvais mot de passe, cookie httpOnly | OK |
| 6 | Configuration initiale non rejouable après création admin | OK |
| 7 | Mots de passe non concordants refusés (serveur) | OK |
| 8-10 | Client créé, modifié (ville persistée), recherche | OK |
| 11-12 | Devis 1200 TTC, PDF 23 511 octets | OK |
| 13 | Migration réelle base 1.0.0 (anciens identifiants, données) | OK |
| 14 | Mot de passe absent en clair dans la base | OK |
| 15-16 | Sauvegarde (signature SQLite) + restauration + écriture post | OK |
| 17 | Refus fichier non SQLite (intégrité) | OK |
| — | typecheck / lint / tests unitaires 9-9 | OK |
| — | Désinstallation silencieuse, base préservée | OK |

## À faire côté diffusion (personne humaine)
- Regénérer manuellement le hash/crédit à chaque publication GitHub
  Release (le fichier .blockmap de 1.1.0 accompagne l'exe pour les mises
  à jour delta).
- Ne pas publier automatiquement — pas de compte GitHub pris en charge
  durant cette session.
- Clés de signature : documenter l'installeur non signé (notice §1).
