# IRONZ Gestion

[⬇️ Télécharger IRONZ Gestion 0.1.0 pour Windows](https://github.com/imadJHR/application-ironz/releases/download/v0.1.0/IRONZ-Gestion-Setup-0.1.0.exe)

- Windows 64 bits
- Installation simple avec NSIS
- Fonctionnement 100 % hors ligne
- Base de données SQLite locale
- Aucun serveur externe nécessaire

**IRONZ Gestion** est une application de gestion commerciale pour Windows,
en français, qui fonctionne **100 % hors ligne** : la base de données est
stockée sur votre poste, aucun compte en ligne, aucun abonnement et aucun
serveur externe ne sont nécessaires.

## Télécharger

> - **Fichier** : `IRONZ-Gestion-Setup-0.1.0.exe` (135,8 Mo, Windows 64 bits)
> - **SHA-256** : `760F7528FB16D25AC7DDB358BE299F68CC79ECDA23F5CFDFE0E3603DC19DD97E` (voir aussi le fichier SHA256SUMS de la release)
> - [Notice d'installation complète](https://github.com/imadJHR/application-ironz/releases/download/v0.1.0/IRONZ-Notice-Installation.txt)

L'installateur n'est **pas signé numériquement** : Windows SmartScreen peut
afficher un avertissement au premier lancement. Cliquez sur
**Informations complémentaires** puis **Exécuter quand même**.

## Installation Windows

1. Téléchargez le fichier `IRONZ-Gestion-Setup-0.1.0.exe` (bouton ci-dessus,
   ou via la release v0.1.0).
2. Lancez l'installateur.
3. Suivez les étapes d'installation de l'assistant NSIS.
4. Ouvrez **IRONZ Gestion** depuis le menu Démarrer ou le raccourci du bureau.
5. Créez votre compte **administrateur** au premier lancement : entreprise,
   nom, email et mot de passe de 12 caractères minimum. Cette configuration
   initiale n'apparaît qu'une seule fois et ne peut pas être rejouée. C'est
   le **seul compte** de l'installation (application monoposte, un seul
   utilisateur avec un accès complet).
6. Notez le **code de récupération** affiché à la fin de la configuration :
   il s'affiche une seule fois — conservez-le en lieu sûr.

Aucun identifiant n'est fourni par défaut : vous définissez le vôtre.
Installer une mise à jour par-dessus une version existante conserve vos
données et vos comptes.

## Fonctionnalités

| Module | Description |
| --- | --- |
| Clients | Entreprises et particuliers (ICE), fiches, historique commercial, archivage |
| Catalogue | Produits et services, références, prix, unités, TVA |
| Devis | Devis professionnels avec suivi des statuts et conversion en commandes |
| Commandes | Conversion transactionnelle depuis les devis, suivi complet |
| Livraisons | Bon de livraison, livraisons partielles ligne par ligne |
| Factures | Factures avec paiements multiples ou partiels, suivi des échéances |
| Paiements | Contrôles de solde en transaction, historique par facture |
| PDF | Formats A4 avec logo, mentions et pagination (les bons de livraison masquent les prix) |
| Recherche | Recherche globale et filtres dans tous les modules |
| Conflit de comptes hérités | Comptes d'essais antérieurs signalés dans « Paramètres » : fusion décidée par l'administrateur (mot de passe requis), aucune suppression automatique |
| Sauvegarde / Restauration | Sauvegarde et restauration de vos données en deux clics (menu Paramètres) |
| Mises à jour | Vérification volontaire des nouvelles versions (Paramètres) sur le dépôt GitHub officiel : numéro, nouveautés, lien direct de l'installateur — jamais d'installation automatique |

## Sécurité et données

- Les données sont stockées **localement sur votre poste**, dans votre
  dossier utilisateur : chaque installation possède sa propre base
  **SQLite** indépendante.
- L'application fonctionne entièrement hors ligne : **aucune donnée ne
  quitte jamais votre ordinateur** (aucun serveur, aucune télémétrie).
- Un seul **compte administrateur par installation** (application
  monoposte) : les anciens comptes commercial/comptabilité d'essais
  antérieurs ne peuvent plus se connecter et sont proposés à la fusion
  depuis « Paramètres », décision de l'administrateur avec son mot de
  passe — jamais de suppression automatique.
- Les mots de passe sont protégés par **scrypt** (paramètres renforcés et
  versionnés, recommandations OWASP).
- Un **code de récupération** unique est affiché une seule fois à la
  configuration initiale : il permet de retrouver l'accès à votre compte
  si vous oubliez votre mot de passe, entièrement hors ligne. Il est
  conservé uniquement sous forme de hachage et est à usage unique.
- Installer une mise à jour, ou même désinstaller l'application, ne
  supprime pas votre base de données : vos données restent dans
  `AppData\Roaming\ironz-gestion`. Sauvegarder régulièrement vos données
  est recommandé (menu Paramètres).

## Liens

- [GitHub Release v0.1.0](https://github.com/imadJHR/application-ironz/releases/tag/v0.1.0)
- [Notice d'installation](https://github.com/imadJHR/application-ironz/releases/download/v0.1.0/IRONZ-Notice-Installation.txt)
- [CHANGELOG](distribution/CHANGELOG.md)

## Pour les développeurs

- [CHANGELOG détaillé](distribution/CHANGELOG.md)
- [Documentation de l'ancienne architecture Web (Next.js + MongoDB Atlas)](docs/ARCHITECTURE-WEB-MONGODB.md) — conservée pour référence technique.
- [Rapport de validation interne](distribution/SESSION-1.1.2-RAPPORT.md) — dossier de tests de livraison (maintenance interne).

Application Desktop : Electron, SQLite, Prisma, Next.js. Application Web (historique) : Next.js App Router, MongoDB Atlas, Prisma 6. Consultez [docs/ARCHITECTURE-WEB-MONGODB.md](docs/ARCHITECTURE-WEB-MONGODB.md) pour l'architecture web complète.
