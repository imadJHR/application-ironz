# IRONZ Gestion

Application privée de gestion commerciale, en français, exclusivement pour IRONZ. Aucun compte public, abonnement, sélecteur d’entreprise ou modèle multi-tenant.

## Démarrage local

Node.js 22 ou supérieur et un cluster MongoDB Atlas.

Créez le cluster Atlas, autorisez l’adresse IP de votre poste dans la liste réseau, puis créez un utilisateur d’application. Copiez `.env.example` vers `.env` et remplacez `DATABASE_URL` par l’URI MongoDB Atlas du cluster. Les caractères spéciaux du nom d’utilisateur et du mot de passe doivent être encodés dans l’URI. Ne partagez pas cette URI et ne commitez jamais `.env`.

```powershell
npm ci
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Ouvrez [IRONZ local](http://localhost:3000). Identifiant et mot de passe initiaux : les valeurs `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans `.env`. Choisissez un mot de passe long et unique. Le seed ne remplace jamais le mot de passe d’un compte existant. La base Atlas est configurée pour démarrer vide ; les anciennes données PostgreSQL locales restent dans `.local/postgres` et ne sont ni migrées ni supprimées.

Pour importer une fois les produits exportés (uniquement vers la base destination `ironz`, et seulement si son catalogue est vide) :

```powershell
npm run db:import-products -- "C:\Users\imadj\Desktop\test.products.json"
```

L’import conserve les SKU existants, laisse les références absentes vides, garde les prix tels quels avec une TVA à 0 %, et combine catégorie/sous-catégorie. Il ne supprime ni ne remplace aucun produit existant. Les images, promotions, évaluations et stocks ne sont pas importés dans la version actuelle du catalogue.

## Identité IRONZ

Le dépôt initial ne contenait aucun logo ni référence de document. Le logo jaune a été intégré depuis le [site officiel IRONZ](https://www.ironz.ma/) et la palette de l’application utilise le jaune, le noir et le blanc. Vous pouvez remplacer le logo dans **Paramètres** si l’équipe fournit une variante interne. Complétez aussi les coordonnées, mentions légales, conditions et informations bancaires avant les premiers documents. Aucun détail légal ou bancaire n’est inventé.

Les informations de l’entreprise, du client et des articles sont copiées dans chaque document. Modifier un client ou les paramètres ne modifie jamais les documents existants. La devise ne peut plus changer après la création du premier document.

## Fonctionnement

- **Clients** : création, recherche, modification, archivage et historique commercial.
- **Catalogue** : produits/services, références uniques, prix, unités, TVA et désactivation.
- **Devis → commandes → livraisons → factures** : conversions transactionnelles, références reliées et snapshots conservés.
- **Livraisons partielles** : chaque ligne référence sa ligne de commande ; les brouillons réservent leurs quantités ; seules les livraisons livrées/réceptionnées comptent comme livrées.
- **Factures** : les brouillons sans documents dérivés restent modifiables ; les factures émises sont protégées.
- **Paiements** : paiements partiels/multiples, contrôles de solde en transaction et clé unique contre les répétitions d’une même soumission.
- **Numérotation** : compteurs MongoDB atomiques par type et année, avec unicité et reprise des conflits transactionnels. Jamais `count + 1`.
- **Montants** : décimaux exacts stockés sous forme de chaînes normalisées et calculés avec Decimal.js. Prisma 6 ne prend pas en charge `Decimal` avec MongoDB ; ne convertissez pas ces champs en nombres flottants pour les calculs métier.
- **PDF** : routes authentifiées, formats A4 dédiés, pagination, pied de page récurrent, logo et informations copiées ; les BL masquent les prix.
- **Recherche** : recherche globale, filtres des modules et pagination côté serveur.
- **Tableau de bord** : données MongoDB réelles, dates sélectionnées, échéances calculées et journal des opérations. Aucun exemple commercial n’est injecté.

MongoDB Atlas doit être un cluster compatible replica set pour les transactions interactives. Les relations Prisma sont vérifiées côté application et n’ajoutent pas de clés étrangères MongoDB. Les devis envoyés arrivés à expiration et les factures échues affichent automatiquement leur état effectif, sans tâche cron. Annuler une commande avec des documents actifs ou une facture avec paiements est interdit. Les avoirs, rapprochements bancaires et envois automatiques d’emails ne font pas partie de cette version.

## Comptes et autorisations

Le premier administrateur est créé uniquement par le seed. Les administrateurs créent les comptes des employés depuis l’application.

| Rôle         | Accès                                                         |
| ------------ | ------------------------------------------------------------- |
| ADMIN        | Tous les modules, utilisateurs et paramètres                  |
| COMMERCIAL   | Clients, catalogue, devis, commandes, livraisons et factures  |
| COMPTABILITE | Factures, paiements, tableaux et consultation de l’historique |

Chaque lecture et mutation est contrôlée côté serveur. Les mots de passe sont salés avec scrypt ; les sessions utilisent des jetons aléatoires dont seuls les hashes sont stockés. Cookies HttpOnly/SameSite, Secure en production, expiration après huit heures et limite durable des tentatives de connexion. Désactiver un compte ou réinitialiser son mot de passe révoque ses sessions.

`PREVIEW_MODE=true` permet seulement un aperçu **local en développement** sans base. Il expose des états vides et refuse toute écriture. Il ne peut jamais contourner l’authentification en production.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests navigateur contre la base MongoDB dédiée `ironz_test` (l’utilisateur Atlas doit pouvoir créer et supprimer cette base) :

```powershell
npm run test:setup
node --env-file=.env.test.local node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001
# Autre terminal
npm run test:e2e
```

Installer Chromium si nécessaire : `npx playwright install chromium`. Le fichier privé `.env.test.local` est généré avec des identifiants aléatoires. La configuration E2E supprime et recrée uniquement la base `ironz_test`, jamais la base métier indiquée dans l’URI. Les tests couvrent authentification, chaîne complète, livraisons partielles, paiements concurrents, numérotation concurrente, snapshots, archivage, rôles, PDF et mise en page mobile.

## Déploiement privé

1. Configurez MongoDB Atlas avec un accès réseau restreint, un utilisateur d’application dédié, les sauvegardes et la restauration à un instant donné.
2. Renseignez `DATABASE_URL` avec l’URI MongoDB Atlas et `APP_URL` avec l’origine HTTPS exacte. Utilisez un cluster compatible replica set.
3. Exécutez `npm ci`, `npm run db:generate` puis `npm run db:push` avant le démarrage de l’application.
4. Définissez temporairement `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_NAME`, puis exécutez le seed une seule fois. Retirez le mot de passe initial des variables de déploiement après création du compte.
5. Construisez avec `npm run build` et démarrez avec `npm start`, ou configurez un projet Next.js privé sur Vercel. Les routes métiers restent protégées même si le serveur est accessible sur Internet.
6. Importez le logo officiel, complétez le profil IRONZ et vérifiez les conditions des documents avant usage réel.
7. Testez une restauration de sauvegarde avant de confier les données commerciales au service. Répétez ce contrôle régulièrement.

Ne lancez pas les tests E2E contre une base qui contient des données utiles. Ne commitez aucun fichier `.env`, donnée `.local` ou artefact de test privé.

Documentation : [installation Next.js](https://nextjs.org/docs/app/getting-started/installation), [connecteur MongoDB Prisma 6](https://www.prisma.io/docs/orm/v6/core-concepts/supported-databases/mongodb), [champs Decimal Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-client/special-fields-and-types) et [transactions Prisma 6](https://www.prisma.io/docs/orm/v6/orm/prisma-client/queries/transactions).

## Structure

`src/app` : routes et layouts App Router. `src/components` : navigation, formulaires et primitives UI. `src/features/documents` : données et rendus de documents. `src/server` : autorisation, accès MongoDB, validation et opérations transactionnelles. `prisma` : schéma MongoDB et seed. `tests` : calculs, sécurité et parcours navigateur.
