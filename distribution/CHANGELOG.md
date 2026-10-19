# CHANGELOG — IRONZ Gestion (desktop)

## 0.1.2 — Mises à jour

Nouvelle section "Paramètres" ▸ "Mises à jour".

- Affichage de la version installée et bouton "Rechercher des mises
  à jour" (vérification volontaire, jamais automatique).
- Consultation des versions publiées sur le dépôt GitHub officiel :
  numéro de version, date, nouveautés et lien direct vers
  l'installateur Windows dans la Release officielle.
- Aucune installation automatique : le téléchargement s'ouvre dans le
  navigateur, l'installateur reste à exécuter manuellement.
- Sécurité : GET public uniquement (aucune donnée locale transmise),
  liens limités au dépôt officiel, aucune exécution de fichier.
- Hors ligne : message "Connexion Internet indisponible", l'application
  reste 100 % fonctionnelle.

## 0.1.1 — Compte unique

L'application devient monoposte stricte : un seul compte
administrateur par installation.

- Suppression de la gestion des utilisateurs et de la création de
  comptes (le compte administrateur est le seul compte de
  l'installation, créé à la première configuration).
- Les comptes hérités des essais antérieurs (anciens comptes
  commercial / comptabilité) ne peuvent plus se connecter. Ils
  apparaissent dans "Paramètres" ▸ "Comptes hérités détectés" : rien
  n'est supprimé automatiquement, l'administrateur décide. La fusion
  rattache documents, paiements et journal à son compte, confirmée par
  son mot de passe actuel — aucune donnée commerciale n'est perdue.

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
