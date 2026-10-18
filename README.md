# IRONZ Gestion

[⬇️ Télécharger IRONZ Gestion 1.1.1 pour Windows](https://github.com/imadJHR/application-ironz/releases/download/v1.1.1/IRONZ-Gestion-Setup-1.1.1.exe)

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

> - **Fichier** : `IRONZ-Gestion-Setup-1.1.1.exe` (135,7 Mo, Windows 64 bits)
> - **SHA-256** : `D3E3F65AA8FB7EB182447CFFCE09AD9E0B9401CA5E2885D627620B5000645D1C`
> - [Notice d'installation complète](https://github.com/imadJHR/application-ironz/releases/download/v1.1.1/IRONZ-Notice-Installation.txt)

L'installateur n'est **pas signé numériquement** : Windows SmartScreen peut
afficher un avertissement au premier lancement. Cliquez sur
**Informations complémentaires** puis **Exécuter quand même**.

## Installation Windows

1. Téléchargez le fichier `IRONZ-Gestion-Setup-1.1.1.exe` (bouton ci-dessus,
   ou via la [Release v1.1.1](https://github.com/imadJHR/application-ironz/releases/tag/v1.1.1)).
2. Lancez l'installateur.
3. Suivez les étapes d'installation de l'assistant NSIS.
4. Ouvrez **IRONZ Gestion** depuis le menu Démarrer ou le raccourci du bureau.
5. Créez votre compte **administrateur** au premier lancement : entreprise,
   nom, email et mot de passe de 12 caractères minimum. Cette configuration
   initiale n'apparaît qu'une seule fois et ne peut pas être rejouée.

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
| Backup & Restore | Sauvegarde et restauration de vos données en deux clics (menu Paramètres) |

## Sécurité et données

- Les données sont stockées **localement sur votre poste**, dans votre
  dossier utilisateur : chaque installation possède sa propre base
  **SQLite** indépendante.
- L'application fonctionne entièrement hors ligne : **aucune donnée ne
  quitte jamais votre ordinateur** (aucun serveur, aucune télémétrie).
- Les mots de passe sont protégés par **scrypt** (paramètres renforcés et
  versionnés, recommandations OWASP).
- Installer une mise à jour, ou même désinstaller l'application, ne
  supprime pas votre base de données : vos données restent dans
  `AppData\Roaming\ironz-gestion`.

## Liens

- [GitHub Release v1.1.1](https://github.com/imadJHR/application-ironz/releases/tag/v1.1.1)
- [Notice d'installation](https://github.com/imadJHR/application-ironz/releases/download/v1.1.1/IRONZ-Notice-Installation.txt)
- [CHANGELOG](distribution/CHANGELOG.md)

## Pour les développeurs

- [CHANGELOG détaillé](distribution/CHANGELOG.md)
- [Documentation de l'ancienne architecture Web (Next.js + MongoDB Atlas)](docs/ARCHITECTURE-WEB-MONGODB.md) — conservée pour référence technique.
- [Rapports de session de livraison](distribution/SESSION-1.1.1-RAPPORT.md)

Application Desktop : Electron, SQLite, Prisma, Next.js. Application Web (historique) : Next.js App Router, MongoDB Atlas, Prisma 6. Consultez [docs/ARCHITECTURE-WEB-MONGODB.md](docs/ARCHITECTURE-WEB-MONGODB.md) pour l'architecture web complète.
