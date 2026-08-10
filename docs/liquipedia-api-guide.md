# Guide d'intégration API Liquipedia DB (v3)

Source officielle : https://api.liquipedia.net/documentation/api/v3
Spécification technique complète (OpenAPI) : liquipedia-openapi-v3.json

## 1. Authentification par clé API

- Chaque requête doit inclure le header HTTP `Authorization`.
- Format attendu : `Apikey TA_CLE_API`
- Chaque requête doit aussi préciser le paramètre `wiki` (le jeu/wiki concerné, ex: dota2, leagueoflegends, valorant...).
- Pour interroger plusieurs wikis en une seule requête, séparer les noms de wiki avec un | (pipe).
- Les clés API se génèrent/se récupèrent depuis la page "API keys" de ton dashboard Liquipedia (accès géré par un admin/manager de ton organisation).
- Ne jamais exposer ta clé API dans du code public (GitHub, front-end, etc.) : elle doit rester côté serveur ou en variable d'environnement.

## 2. Requêtes de base

- URL de base : https://api.liquipedia.net/api
- Toutes les requêtes sont en GET.
- Le client doit accepter l'encodage gzip.
- Un code HTTP différent de 200 indique une requête échouée.
- Les autres paramètres (filtres, tri, etc.) sont passés en query string dans l'URL.

## 3. Structure de la réponse JSON

La réponse contient jusqu'à 3 clés :
- result : tableau d'objets résultats (vide si requête invalide)
- error (optionnel) : tableau de messages d'erreur
- warning (optionnel) : tableau d'avertissements non bloquants (ex: dépréciations)

Exemple de structure :
```json
{
  "result": [
    { "id": "...", "name": "...", "nationality": "..." }
  ]
}
```

## 4. Paramètres de filtrage disponibles

| Paramètre | Rôle |
|---|---|
| limit | Nombre de résultats souhaités (défaut 20, max 1000) |
| offset | Décalage du premier résultat retourné (défaut 0) |
| conditions | Filtres façon SQL, syntaxe [[colonne::valeur]] avec opérateurs :: (égal), ::! (différent), ::<, ::>. Combinables avec AND/OR et parenthèses. Fonctions de date possibles : YEAR(), MONTH(), DAY(), HOUR(), MINUTE(), SECOND() |
| query | Liste de champs à retourner (séparés par virgule). Fonctions agrégées possibles : COUNT(), SUM(), AVG(), MAX(), MIN() |
| order | Tri façon SQL, ex: id ASC |
| groupby | Regroupement façon SQL |

Note : en cas de requête multi-wiki, limit, offset, order et groupby s'appliquent par wiki.

## 5. Endpoints principaux (data types)

/v3/broadcasters, /v3/company, /v3/datapoint, /v3/externalmedialink, /v3/match, /v3/placement, /v3/player, /v3/series, /v3/squadplayer, /v3/standingsentry, /v3/standingstable, /v3/team, /v3/tournament, /v3/transfer, /v3/teamtemplate, /v3/teamtemplatelist

Pour le détail complet des paramètres et schémas de chaque endpoint, se référer au fichier liquipedia-openapi-v3.json (spécification OpenAPI officielle).

## 6. Notes utiles pour l'intégration

- Possibilité de doublons dans les résultats : prévoir un filtrage côté client ou utiliser groupby.
- La liste des wikis disponibles est visible sur la page officielle : https://api.liquipedia.net/documentation/api/v3

---
Pour toute mise à jour, se référer à la doc officielle : https://api.liquipedia.net/documentation/api/v3
