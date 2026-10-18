# Session 1.1.2 — Récupération hors ligne du compte administrateur

## Fichiers livrables
- `desktop/dist/IRONZ-Gestion-Setup-1.1.2.exe` — **135,8 Mo**
  (142 396 828 octets) — SHA-256
  `3C13AF5F26852208EFB9154F3DFBC3CA02F3FE99AB1095549BFF6D9B9FBC8549`
- `desktop/dist/IRONZ-Gestion-Setup-1.1.2.exe.blockmap` + `latest.yml`
  (générés à la construction)
- `desktop/dist/IRONZ-Notice-Installation.txt` (1.1.2, + section
  « Mot de passe oublié »)

## Fonctionnalité (résumé)
- Code de récupération 128 bits (`crypto.randomBytes(16)`), affichage
  unique, stockage = hash SHA-256 uniquement, usage unique.
- First Run Setup : écran dédié après création de l'administrateur
  (notez le code → « Aller à la connexion »).
- Page de connexion : « Mot de passe oublié ? » → formulaire
  email/code/nouveau mot de passe ; en cas de succès, mot de passe
  remplacé, sessions fermées, NOUVEAU code affiché une seule fois,
  opération tracée dans le journal d'activités (sans secret).
- Paramètres ▸ Code de récupération : régénération par admin connecté
  (mot de passe actuel exigé) ; l'ancien code devient inutilisable.
- Anti-bruteforce : 10 tentatives / email / 15 min (table
  `LoginAttempt`, clé `recovery:<sha256(email)>`) + blocage du code
  après 5 essais erronés ; coût scrypt égalisé sur les échecs.
- Aucune porte dérobée : sans code valide, aucune réinitialisation.
- Réservé Desktop (`isDesktopDb()`), y compris la migration runtime.

## Schéma et migration
- Modèle `RecoveryCode` (`userId` unique, `codeHash` unique,
  `consumedAt`, `failedAttempts`, etc.) dans `schema.sqlite.prisma`
  + miroir `schema.prisma` (Mongo) pour le typage web.
- Migration runtime idempotente (`ensureRecoverySchema` dans
  `src/server/recovery.ts`) : `CREATE TABLE IF NOT EXISTS` — DDL
  identique à `prisma db push` du template, index uniques recréés de
  la même façon. Aucune table existante n'est modifiée : compatible
  1.0.0 / 1.1.0 / 1.1.1 et avec les sauvegardes antérieures
  restaurées.
- Backup & Restore : sans changement de code ; la table du code passe
  dans les sauvegardes (hash uniquement) ; restaure une sauvegarde
  1.1.1 puis recrée la table au premier usage de récupération.

## Constatations techniques
- `refreshed()` (revalidatePath) dans `configureFirstAdmin` faisait
  quitter `/premiere-installation` avant l'affichage unique du code :
  retiré ; la page de connexion est dynamique et détecte l'admin.
- Electron ignore la variable d'environnement `APPDATA` : le lancement
  de l'EXE avec `APPDATA` redirigé a écrit dans la RÉELLE base de
  l'utilisateur. Base vérifiée ensuite (integrity_check ok, mêmes
  comptes, AUCUNE table RecoveryCode créée, aucun dommage). Les tests
  d'EXE lancés utilisent le serveur standalone (`desktop/pack/
  standalone/server.js`) sous node avec `DATABASE_URL` pointée vers
  une base temporaire — jamais l'EXE Electron sur la base réelle.
- PowerShell (`-replace` + `Set-Content`) détruit les accents de
  `README.md` : les modifications de fichiers accentués passent
  EXCLUSIVEMENT par l'outil d'édition ou un script node.

## Tests exécutés (tous réellement passés)
1. Unitaires : 15/15 (`npm test`) — 6 nouveaux sur le code
   (entropie, format 4×8, unicité 1000 tirages, stabilité du hash,
   normalisation, comparaison sûre).
2. Typecheck + ESLint : propres.
3. Smoke 1.1.2 — 26/26 (`desktop/smoke.mjs`) sur le serveur
   standalone + template vierge : setup → code affiché (regex 4×8),
   /connexion, refus de login erroné, connexion, client créé/modifié,
   devis, PDF (23 511 o), recherche, mdp absent du fichier de base,
   backup (signature SQLite), refus de fichier bidon, restauration,
   re-lecture, écriture post-restauration, lien « oublié », code
   erroné refusé (générique), code valide → nouveau mot de passe +
   nouveau code, ancien mdp refusé/nouveau accepté, réutilisation du
   code consommé refusée, régénération depuis Paramètres,
   anti-bruteforce (blocage « Trop de tentatives »), aucun secret
   (mdp ni codes) en clair dans la base.
4. Monte de version 1.1.1 → 1.1.2 E2E (`desktop/migrate-e2e.mjs`)
   sur base héritée sans `RecoveryCode` (`desktop/legacy-base.mjs`,
   hash s2 réel via scrypt) : pas de setup, accès direct à la
   connexion, refus générique sans code, ancien mot de passe
   fonctionnel, création de code depuis Paramètres (migration
   runtime), récupération complète.
5. Migration offline (`desktop/migrate-test.mjs`) sur COPIE de la
   vraie base : DDL idempotent, comptes de lignes inchangés,
   upsert/find/update fonctionnels, relation `User.recoveryCode`
   vérifiée.
6. NSIS : `IRONZ-Gestion-Setup-1.1.2.exe /S` → installé sous
   `%LOCALAPPDATA%\Programs\IRONZ Gestion`, ProductVersion 1.1.2.0 /
   FileVersion 1.1.2 ; lancement → serveur local 200 ; hash de la
   base réelle IDENTIQUE avant/après (poc : rien n'est écrit au
   simple lancement) ; désinstallation /S → programme retiré, base
   préservée identique.

## Aucune publication
- Rien n'a été poussé ni publié : branche locale
  `feature/recovery-v1.1.2`, commit unique, aucune Release GitHub
  (accord utilisateur requis, comme pour la 1.1.1).
- Les scripts de test du dépôt ne contiennent plus AUCUN mot de passe
  en dur : les fixtures régénèrent aléatoirement leurs mots de passe à
  chaque exécution (`legacy-base.mjs` les passe à `migrate-e2e.mjs`
  via un fichier temporaire hors dépôt). Scan final « 0 secret en
  dur » dans `desktop/`, `tests/`, `src/`.
