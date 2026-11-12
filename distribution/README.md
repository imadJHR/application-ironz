# Notices Distributions IRONZ Gestion

Ce dossier regroupe les documents de livraison du programme IRONZ Gestion
(application Windows .exe, SQLite locale, 100 % hors ligne).

## Contenu

| Fichier | Rôle |
| --- | --- |
| `IRONZ-Notice-Installation.txt` | Notice d'installation officielle version 0.1.2 (à envoyer avec l'installateur) |
| `CHANGELOG.md` | Historique des versions livrées |

## Livrables (dans `desktop/dist/`)

| Fichier | Version | SHA-256 |
| --- | --- | --- |
| `IRONZ-Gestion-Setup-0.1.2.exe` | 0.1.2 | [Sommes SHA-256 de la release](https://github.com/imadJHR/application-ironz/releases/download/v0.1.2/SHA256SUMS.txt) |
| `IRONZ-Gestion-Setup-0.1.1.exe` | 0.1.1 | [Sommes SHA-256 de la release](https://github.com/imadJHR/application-ironz/releases/download/v0.1.1/SHA256SUMS.txt) |
| `IRONZ-Gestion-Setup-1.1.1.exe` | 1.1.1 | voir `SESSION-1.1.1-RAPPORT.md` |
| `IRONZ-Gestion-Setup-1.1.0.exe` | 1.1.0 | `C7FAFF597A6C857E4F0F074805D72FA6CAFFA7227501C10EBEB2D4DF8F9A87DD` |
| `IRONZ-Gestion-Setup-1.0.0.exe` | 1.0.0 | `60707AF2138EC43DEE32D17553199073A6922DABF69D1A1D96FF2805AF310275` |

## Notes d'intégration

- L'installeur NSIS est **non signé** (pas de certificat de signature) :
  Windows SmartScreen peut afficher un avertissement à la première
  exécution. Documenté dans la notice.
- La version 1.1.1 n'embarque **aucun identifiant par défaut** : le compte
  administrateur est créé au premier lancement par l'utilisateur.
- Les bases existantes de la 1.0.0 / 1.1.0 (mot de passe initial temporaire
  ou compte administrateur créé au premier lancement) restent compatibles :
  mise à jour sans migration de données.
