# CHANGELOG — IRONZ Gestion (desktop)

## 0.1.1 — Livraison depuis les factures

- Création d’un bon de livraison depuis une facture émise, y compris après paiement. Les livraisons partielles sont liées à la facture et limitées aux quantités restantes.
- Les paiements simultanés sont contrôlés dans une transaction SQLite pour éviter de dépasser le solde.
- La restauration vérifie le fichier SQLite, conserve une copie de sécurité et demande une reconnexion après remplacement des données.
- Correctifs de sécurité des dépendances de production.

## 0.1.0 — Première version publique

Première version publique de l'application Desktop IRONZ Gestion
(Windows, monoposte, 100 % hors ligne).

Fonctionnalités
- Gestion des clients (fiches complètes, recherche, édition, archivage).
- Catalogue de produits et de services.
- Devis, commandes, bons de livraison et factures, avec documents PDF
  générés localement (formats A4 avec logo, mentions et pagination).
- Suivi des paiements (encaissements, groupes de factures, contrôles
  de solde en transaction).
- Recherche globale depuis l'en-tête de l'application.
- Premier lancement guidé : configuration unique du compte
  administrateur (aucun identifiant livré par défaut). L'application
  est monoposte : ce compte est le seul de l'installation.
- Code de récupération 128 bits affiché une seule fois, régénérable
  depuis les paramètres (mot de passe actuel exigé).
- Comptes hérités d'essais antérieurs : signalés dans "Paramètres" ▸
  "Comptes hérités détectés" — fusion décidée par l'administrateur
  (réaffectation de l'historique, mot de passe requis), jamais
  automatique.
- Section "Paramètres" ▸ "Mises à jour" : vérification volontaire des
  nouvelles versions sur le dépôt GitHub officiel (version installée,
  nouveautés, lien direct de l'installateur). Aucune installation
  automatique, aucune donnée locale transmise, hors ligne propre.
- Sauvegarde et restauration SQLite intégrées (contrôle d'intégrité,
  copie de sécurité datée avant restauration).
- Journaux de diagnostic conservés dans le dossier de données
  (launch.log, server-err.log, server-out.log).

Sécurité
- Mot de passe administrateur personnel (12 caractères minimum,
  chiffrage scrypt renforcé, jamais en clair dans la base).
- Les comptes non administrateur des anciennes installations ne
  peuvent plus se connecter (refus générique, anti-énumération).
- Vérification des mises à jour : GET public uniquement, liens
  filtrés vers le dépôt officiel, aucun fichier téléchargé exécuté.
- Protections anti-bruteforce (fenêtre glissante) côté application.

Détails techniques
- Installation NSIS utilisateur (aucun droit administrateur requis).
- Base SQLite locale unique ; l'application fonctionne sans aucun
  serveur extérieur.

Versions antérieures : uniquement des essais internes ; leur
historique reste consultable dans le dépôt Git et les rapports de
test du dossier distribution/.
