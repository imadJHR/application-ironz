# CHANGELOG — IRONZ Gestion (desktop)

## 0.1.0 — Première version publique

Première version publique de l'application Desktop IRONZ Gestion
(Windows, monoposte, 100 % hors ligne).

Fonctionnalités
- Gestion des clients (fiches complètes, recherche, édition).
- Catalogue de produits et de services.
- Devis, commandes, bons de livraison et factures, avec documents PDF
  générés localement.
- Suivi des paiements (encaissements, groupes de factures).
- Recherche globale depuis l'en-tête de l'application.
- Gestion des utilisateurs (comptes de votre entreprise).
- Première configuration guidée : création du compte administrateur
  à la première ouverture (aucun identifiant livré par défaut).
- Sauvegarde et restauration SQLite intégrées, avec contrôle
  d'intégrité et copie de sécurité datée avant restauration.

Sécurité
- Mot de passe administrateur personnel (12 caractères minimum,
  chiffrage scrypt, jamais en clair dans la base).
- Code de récupération 128 bits affiché une seule fois, conservé
  uniquement sous forme de hachage, à usage unique.
- Régénération du code possible depuis les paramètres (mot de passe
  actuel exigé) et protections anti-bruteforce côté application.

Détails techniques
- Installation NSIS utilisateur (aucun droit administrateur requis).
- Base SQLite locale unique ; l'application fonctionne sans aucun
  serveur extérieur.

Versions antérieures : uniquement des essais internes ; leur
historique reste consultable dans le dépôt Git et les rapports de
test du dossier distribution/.
