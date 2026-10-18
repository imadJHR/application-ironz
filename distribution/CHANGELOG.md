# CHANGELOG — IRONZ Gestion (desktop)

## 1.1.1 — Finalisation officielle

- Bump de version 1.1.0 → 1.1.1 (`package.json`, `package-lock.json`,
  installeur NSIS `IRONZ-Gestion-Setup-1.1.1.exe`, notices et CHANGELOG).
- Aucune modification fonctionnelle : la 1.1.1 porte exactement les
  fonctionnalités et corrections validées en 1.1.0 (configuration initiale,
  chiffrement scrypt versionné, sauvegarde/restauration intégrées).
- Window Metadata Windows/NSIS alimentées par la version du `package.json`
  (aucun identifiant de version codé en dur).
- Revalidation complète : typecheck, ESLint, tests unitaires, tests de
  fumée 18 étapes, installation/désinstallation NSIS per-user, migration
  1.0.0 → 1.1.1 sur base réelle.
- Synchronisation du champ version de la racine `package-lock.json`
  (resté en 1.0.0 du cycle antérieur).

## 1.1.0 — Sécurité du premier accès + sauvegarde intégrée

Sécurité
- **Plus aucun identifiant par défaut** : la base embarquée (template
  SQLite) est livrée 100 % vierge, sans compte utilisateur ni seed.
- **Configuration initiale** au premier lancement (`/premiere-installation`) :
  nom d'entreprise, administrateur, email, mot de passe (12 caractères
  minimum, confirmation). La page disparaît dès qu'un ADMIN existe et ne peut
  pas être rejouée (vérification + création dans une vraie transaction SQLite,
  protégée contre les doubles soumissions). L'accès `/` renvoie vers
  `/connexion`, qui elle-même renvoie vers la configuration tant qu'aucun
  administrateur n'existe.
- **Hachage des mots de passe renforcé et versionné** : format
  `s2(N=131072;r=8;p=1):sel:clé` (scrypt, paramètres OWASP interactifs),
  avec rétro-compatibilité complète des hachages 1.0.0 (vérifié en base
  réelle). Les identifiants temporaires de la 1.0.0 ne circuleraient plus
  dans le code source ni les scripts de build.
- Tests de fumée modernisés (18 étapes) : aucun identifiant connu requis,
  tout le flux part de la configuration initiale, contrôle qu'aucun mot de
  passe n'est stocké en clair.

Sauvegarde et restauration (Paramètres ▸ Sauvegarde et restauration, admin)
- `GET /api/system/backup?create=1` : création d'une sauvegarde vérifiée
  (checkpoint WAL + intégrité + tables cœur) puis téléchargement ; une copie
  datée reste dans `%APPDATA%\ironz-gestion\sauvegardes\`. Accès
  administrateur uniquement (401/403 sinon).
- `POST /api/system/restore` : restauration d'un fichier `.db` téléversé.
  Contrôles avant remplacement : signature SQLite, taille, `integrity_check`
  et présence des tables cœur. La base actuelle est conservée comme
  `ironz-avant-restauration-<horodatage>.db` avant l'échange ; post-
  vérification avec restauration automatique de la base précédente en cas
  d'échec ; gestion du verrou Windows (attentes contrôlées, fallback copie
  en place). Les sessions sont automatiquement invalidées (retour à la
  connexion).
- Panneau dédié dans les Paramètres avec confirmation de restauration
  et affichage de la dernière sauvegarde du poste.

Build et distribution
- Suppression du seed desktop et de `desktop/.env.desktop` : le build ne
  produit/consomme plus d'identifiants.
- `desktop/build.mjs` : template SQL vierge (prisma db push, sans seed) ;
  moteur Prisma et template embarqués inchangés ; installeur NSIS inchangé
  (per-user, ~ 136 Mo, asar, désinstallation préservant les données).
- Version : `IRONZ-Gestion-Setup-1.1.0.exe`.

Validation
- Typecheck ✓ — ESLint ✓ — 9/9 tests unitaires ✓ (dont temps constant et sel
  de scrypt).
- Test de fumée packagé **18/18** : setup-first, refus mots de passe non
  concordants, setup non rejouable, refus mauvais mot de passe, connexion,
  client créé/modifié (ville persistée), devis, PDF (23 511 octets),
  recherche, chiffrement en base, sauvegarde (signature SQLite), refus
  fichier bidon, restauration réelle, lecture des données restaurées,
  écriture post-restauration.
- Version installée vérifiée (installation silencieuse, première
  configuration, connexion, protection des API) ; désinstallation propre,
  base préservée.
- Migration 1.0.0 → 1.1.0 vérifiée sur une base réelle 1.0.0 : pas de
  configuration initiale, connexion avec les anciens identifiants, données
  intactes.

## 1.0.0 — Livraison initiale desktop

- Application Electron + serveur Next standalone + SQLite locale,
  100 % offline ; installeur NSIS par utilisateur (~136 Mo, 136 s) ;
  asar ; template de base pré-seedée (identifiants temporaires
  — retirés en 1.1.0) ; smoke 9 étapes ; notice d'installation
  (`IRONZ-Notice-Installation.txt`).
