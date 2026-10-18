# CHANGELOG — IRONZ Gestion (desktop)

## 1.1.2 — Récupération hors ligne du compte administrateur

Sécurité et récupération
- **Code de récupération cryptographique** (16 octets, `crypto.randomBytes`,
  128 bits d'entropie), affiché en 4 groupes hexadécimaux. Généré au
  premier démarrage (configuration initiale), affiché **une seule fois**,
  stocké uniquement sous forme de hash SHA-256 — jamais en clair, jamais
  journalisé.
- **Mot de passe oublié** sur la page de connexion : email + code +
  nouveau mot de passe (12 caractères minimum), validation entièrement
  côté serveur. Messages génériques (aucune énumération de comptes).
- **Code à usage unique** : consommé il est définitivement invalide ;
  après une récupération réussie, le mot de passe est remplacé, toutes
  les sessions du compte sont fermées, un NOUVEAU code est généré et
  affiché une seule fois. L'opération est tracée dans le journal
  d'activités (sans aucun secret).
- **Régénération depuis Paramètres** (administrateur connecté, mot de
  passe actuel exigé) : un vol de session ne permet pas de s'emparer
  d'un nouveau code.
- **Protections anti-bruteforce** : limiteur glissant 15 min (10 essais
  par email) + blocage définitif du code après 5 essais erronés ; coût
  scrypt égalisé sur les échecs (aucun chronométrage possible).
- **Aucune porte dérobée** : sans code valide, aucune réinitialisation
  n'est possible, quel que soit l'accès au fichier de base.

Compatibilité
- **Migration SQLite idempotente au runtime** : la table `RecoveryCode`
  est ajoutée à la demande aux bases 1.0.0/1.1.0/1.1.1 et aux
  sauvegardes antérieures restaurées (CREATE TABLE IF NOT EXISTS, AUCUNE
  modification des tables existantes, données inchangées).
- Backup & Restore préservés : les bases/sauvegardes contiennent
  désormais la table du code (hash uniquement) ; une sauvegarde 1.1.1
  reste restaurable sur une 1.1.2 (la table est recréée au premier
  usage si absente).
- Réservé à l'application Desktop : la version Web (MongoDB Atlas) ne
  propose ni la récupération par code ni la migration.

Validation
- Typecheck, ESLint, tests unitaires (15, dont 6 dédiés au code de
  récupération), tests de fumée 26 étapes (setup + code, connexion,
  code erroné/valide, changement de mot de passe, invalidation des
  sessions, réutilisation refusée, régénération, anti-bruteforce,
  sauvegarde/restauration, absence de secrets en clair), monte de
  version 1.1.1 → 1.1.2 E2E sur base héritée, installation/
  désinstallation NSIS avec base utilisateur préservée octet pour
  octet.

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
