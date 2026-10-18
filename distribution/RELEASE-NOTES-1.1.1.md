# IRONZ Gestion 1.1.1 — Notes de release

Application de gestion commerciale **100 % hors ligne** pour Windows
(monoposte, base SQLite locale, serveur applicatif embarqué).

## Téléchargement

| Fichier | Taille | SHA-256 |
| --- | --- | --- |
| `IRONZ-Gestion-Setup-1.1.1.exe` | 135,7 Mo | `D3E3F65AA8FB7EB182447CFFCE09AD9E0B9401CA5E2885D627620B5000645D1C` |

L'installeur est **non signé** numériquement : si Windows SmartScreen
s'affiche, « Informations complémentaires » puis « Exécuter quand même ».

## Nouveautés 1.1.1 / 1.1.0

### Sécurité du premier accès
- **Aucun identifiant par défaut** : la base fournie est totalement vierge.
- Au premier lancement, l'application propose une **configuration initiale**
  (entreprise, administrateur, email, mot de passe 12 caractères minimum).
  Elle n'apparaît qu'une seule fois et ne peut pas être rejouée.
- Mots de passe protégés par **scrypt renforcé** (paramètres versionnés,
  recommandations OWASP) ; compatible avec les comptes de la 1.0.0.

### Sauvegarde et restauration intégrées (Paramètres ▸ administrateur)
- **Sauvegarder mes données** : sauvegarde vérifiée (intégrité et schéma
  contrôlés), téléchargement vers un support externe + copie datée sur le
  poste.
- **Restaurer** : remplacement contrôlé d'une sauvegarde `.db` — signature
  SQLite, intégrité, schéma vérifiés ; la base en cours est automatiquement
  conservée comme sécurité datée ; sessions invalidées après restauration.

### Reste de la gestion (inchangé)
Clients (Entreprise/Particulier, ICE), produits, devis, factures,
paiements, PDF professionnels, recherche, multi-utilisateurs (commercial,
comptabilité).

## Mise à jour depuis 1.0.0 / 1.1.0
Installez par-dessus : vos données et votre compte sont conservés
(vérifié sur une base réelle). Aucun réglage à refaire.

## Désinstallation
Windows ▸ Paramètres ▸ Applications — vos données (ironz.db) restent
dans AppData\Roaming\ironz-gestion.

## Notes techniques
- Windows 10/11 64 bits, installation par utilisateur (aucun admin requis).
- Fonctionne entièrement hors ligne : aucune donnée ne quitte le poste.
- Journal de démarrage : AppData\Roaming\ironz-gestion\launch.log
