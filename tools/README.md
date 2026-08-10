# Générateur de données — API Liquipedia

`players.json` et `teams.json` ne sont plus écrits à la main : ils sont
**générés** depuis l'API Liquipedia DB v3 par `build_data.py`.

Le site, lui, reste 100 % statique — il lit les deux JSON générés et ne connaît
pas l'API. **La clé n'est donc jamais exposée au navigateur.**

## Où mettre la clé API

Trois emplacements possibles. Le bon choix dépend d'une seule question :
**ton déploiement copie-t-il le dossier, ou passe-t-il par le dépôt ?** Une
copie emporterait `.env` sur le serveur, où Apache le servirait en clair ; un
déploiement issu du dépôt ne le peut pas, `.env` étant gitignoré.

**1. Fichier `.env`** à la racine du projet (le plus simple) :

```
LIQUIPEDIA_API_KEY=ta_cle_ici
```

Gitignoré, donc absent du dépôt. À éviter si tu déploies en copiant le dossier.

**2. Variable d'environnement** (utile en CI) :

```powershell
$env:LIQUIPEDIA_API_KEY = "ta_cle_ici"     # PowerShell
```
```bash
export LIQUIPEDIA_API_KEY="ta_cle_ici"     # bash
```

**3. Fichier du profil utilisateur**, hors du projet :

```
C:\Users\<toi>\.liquipedia-api-key      (Windows)
~/.liquipedia-api-key                    (Linux/macOS)
```

La clé seule sur une ligne. Hors du projet, donc impossible à déployer par
accident — c'est l'option à retenir si tu déploies **en copiant** le dossier
(rsync, scp, USB).

⚠️ Ne colle **jamais** la clé dans `script.js`, `index.html` ou un fichier
`.json` : tout ce qui est servi par le site est public.

## Lancer la génération

```bash
python tools/build_data.py
```

Aucune dépendance à installer — stdlib Python uniquement (3.8+).

| Option | Effet |
|---|---|
| `--dry-run` | interroge l'API et affiche le rapport, sans rien écrire |
| `--fresh` | ignore le cache disque et retape l'API |
| `--throttle 3` | secondes minimum entre deux requêtes (défaut : 2) |
| `--require-photo` | exclut du jeu les joueurs sans fichier dans `players_img/` |
| `--require-teams` | exclut les joueurs ayant moins de 2 équipes |
| `--probe player` | dump brut d'un endpoint, pour inspecter les champs réels |

**Première utilisation : commence par `--dry-run`.** Le rapport dit exactement
ce que l'API a trouvé (et surtout ce qu'elle n'a pas trouvé) avant d'écraser
les données existantes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `roster.txt` | un tag de joueur par ligne — maintenu à la main, avec `../players_img/` |
| `aliases.json` | correspondance manuelle tag → pagename Liquipedia, pour les tags non résolus |
| `build_data.py` | le générateur (roster → `players.json` + `teams.json` + `lans.json`) |
| `liquipedia.py` | client API v3 : auth, gzip, throttle, retry 429, cache, masquage de la clé |
| `countries.py` | nationalité Liquipedia (« France ») → code flagcdn (`fr`) |
| `regions.py` | `player.region` (texte libre, « Middle East »/« MENA »…) → une des sept zones affichées (mode de test « Regional Scene ») |
| `build-report.json` | *généré* — bilan du dernier run (non commité) |
| `../logos/` | *généré* — logos téléchargés, un fichier par équipe |
| `.cache/` | *généré* — réponses API brutes, pour ne pas retaper l'API à chaque essai |

## Ce que fait le script

1. **Résolution du roster** — télécharge la table `player` du wiki `rocketleague`
   et rapproche chaque tag de `roster.txt` d'une fiche. Le rapprochement ignore
   casse, accents, espaces, ponctuation et parenthèses de désambiguïsation :
   `fairy peak` ↔ `Fairy Peak!`, `vatira` ↔ `Vatïra`. En cas d'homonymes, les
   gains les plus élevés l'emportent.
2. **Historique d'équipes** — `squadplayer`, trié par `joindate`, rôles non
   joueurs (coach, manager, analyst…) exclus, doublons fusionnés. L'ordre
   chronologique compte : c'est lui que le mode Extreme conserve.
   ⚠️ Le filtre porte sur `link` (« M0nkey M00n », avec des espaces), pas sur le
   pagename souligné — sinon le joueur ressort sans aucune équipe.
3. **Noms et URLs de logos** — table `team`, interrogée **uniquement sur les
   équipes du roster**. Surtout pas `teamtemplatelist` : le wiki compte plus de
   12 000 templates, sa pagination n'arrive même pas à la lettre « d » en 60
   pages. La variante *dark* du logo est préférée : le site est sur fond sombre.
4. **Palmarès** — `placement` filtré sur `liquipediatier::1` (S-Tier), en
   écartant qualifiers, showmatches et placements non classants (W/L/DQ).
   Ici les conditions utilisent le pagename **souligné** (`opponentplayers_pN`).
   Exception : un **podium** (1er/2e/3e) en qualif régionale 1v1/2v2 (« Open »)
   compte quand même — sinon ces deux modes n'auraient jamais de palmarès, vu
   que leurs seules finales S-Tier hors qualif sont les Majors/Worlds 1v1/2v2.
   Le 3v3 garde l'exclusion stricte des qualifs (voir `PODIUM_MODES`). Cette
   même passe repère aussi, pour chaque placement 1v1/2v2, l'équipe que le
   joueur représentait (`p{n}team`) — sert au badge sur les tuiles d'équipe.
5. **LAN** — table `tournament`, interrogée sur les pages de tournoi déjà vues
   à l'étape 4. Ne garde que `type: "Offline"` (une vraie LAN, pas un split ou
   une qualif en ligne). Un Major 3v3 et son volet 1v1/2v2 sont deux pages
   Liquipedia distinctes pour le même évènement physique (mêmes dates, même
   ville) — regroupées sous une seule entrée `lans.json` via le pagename, qui
   ne diffère que par un segment `/1v1/` ou `/2v2/`.
6. **Photos** — depuis le dossier local `players_img/`, **pas** depuis l'API :
   la table `player` du wiki `rocketleague` n'a ni `image` ni `imageurl`.
   Le rapprochement tag → fichier se fait en trois passes (exacte, préfixe,
   plus long préfixe commun ≥ 6 caractères et sans ambiguïté), ce qui rattrape
   les noms tronqués historiques (`chausette45` → `chausette.webp`,
   `Zanejackey` → `zanejacket.webp`).
7. **Assemblage** des trois JSON.
8. **Téléchargement des logos** dans `logos/`, puis écriture de `players.json`,
   `teams.json`, `lans.json` et `build-report.json`.

Coût : ~80 requêtes pour un roster de 200 joueurs. Le cache disque rend les
relances gratuites.

⚠️ **Liquipedia bloque le hotlinking des images.** La même URL de logo répond
`HTTP 200` sans `Referer` et `HTTP 403` avec un `Referer` d'un autre domaine —
et le 403 sert une petite image d'erreur, pas une page d'erreur. Le piège est
donc silencieux : dans le navigateur les images « chargent » (`naturalWidth > 0`)
en affichant l'image de refus. **Pour contrôler un rendu de logos, compter les
dimensions distinctes** : si elles sont toutes identiques, c'est l'image de
refus. C'est la raison d'être de l'étape 7 — les logos sont hébergés par le
site, jamais pointés à distance.

⚠️ **Certaines équipes n'ont pas de logo uploadé sur Liquipedia du tout** —
distinct du hotlinking ci-dessus. Le thumbnailer répond alors `HTTP 200` mais
sert un placeholder « fichier manquant » : le même fichier, vérifié par hash,
constaté sur plus de 200 équipes (souvent des piges ou des sélections
nationales). `download_logos()` le détecte via `MISSING_LOGO_SHA1` et met
`logo` à `null` au lieu de l'héberger — sans ça le front afficherait un logo
générique identique pour ces équipes au lieu de leur nom. Si Liquipedia change
un jour ce placeholder, `python tools/fix_placeholder_logos.py --dry-run`
recompte les logos déjà téléchargés qui y correspondent, sans appel réseau.

Les vignettes sont demandées en **120 px**. Liquipedia ne génère pas toutes les
largeurs : 400 / 120 / 100 / 50 répondent, 150 / 200 / 250 renvoient des 404.
Revérifier avant de changer `LOGO_WIDTH`.

⚠️ **Quota par table.** L'API v3 limite les requêtes *table par table*, et `team`
sature en premier (~900 équipes à résoudre). Un `HTTP 429 … limits … exceeded`
n'est pas une erreur à corriger : il faut attendre la réinitialisation de la
fenêtre et relancer, le cache reprenant là où le run s'était arrêté. **N'utilise
`--fresh` qu'en connaissance de cause**, et ne change pas la taille des lots
dans `fetch_teams()` : elle détermine les clés de cache, la modifier invalide
tout le cache `team` d'un coup.

⚠️ **Liquipedia renvoie ta clé en clair dans ses messages d'erreur de quota.**
`Client._redact()` la masque partout où elle serait journalisée. Ne pas retirer
ce masquage.

## Lire le rapport

`build-report.json` liste ce qui mérite ton attention :

| Clé | À faire |
|---|---|
| `unresolved_tags` | tag introuvable → ajouter le pagename exact dans `aliases.json` |
| `ambiguous_tags` | homonymes détectés → vérifier que la bonne fiche a été prise, forcer via `aliases.json` sinon |
| `players_without_photo` | fichier absent de `players_img/` → le jeu affiche l'initiale du pseudo |
| `players_without_country` | nationalité absente de `countries.py` → l'ajouter |
| `players_without_region` | valeur `player.region` absente de `regions.py` → l'ajouter à `REGION_MAP` |
| `players_without_teams` | fiche `squadplayer` vide côté Liquipedia |
| `teams_without_logo` | le jeu affiche le nom de l'équipe en texte |
| `logo_download_failures` | logo introuvable au téléchargement → tuile en texte |

## Ajouter ou retirer un joueur

Une ligne dans `roster.txt`, la photo dans `players_img/` (nommée d'après le
tag), puis `python tools/build_data.py`. Drapeau, équipes, logos et palmarès
sont récupérés automatiquement ; les tags restés sans photo sont listés en fin
de run.

## Schéma généré

`players.json`
```json
{
  "name": "zen",
  "img": "players_img/zen.webp",
  "teams": ["karmine-corp", "team-vitality"],
  "teamModes": { "team-vitality": ["1v1", "2v2"] },
  "country": "fr",
  "countryName": "France",
  "region": "Europe",
  "achievements": ["1st RLCS 2022-23 - World Championship"],
  "firstSTierDate": "2023-07-09",
  "lastSTierDate": "2026-05-24",
  "lans": ["rlcs-2022-23-world-championship"],
  "earnings": 128450,
  "liquipedia": "https://liquipedia.net/rocketleague/Zen"
}
```

`region` est l'affiliation compétitive **actuelle** (`player.region` sur l'API v3), pas la nationalité — normalisée vers sept zones (Europe, North America, South America, MENA, SSA, Asia-Pacific, Oceania) par `regions.py`, `null` si non reconnue. `firstSTierDate`/`lastSTierDate` sont les bornes du palmarès S-Tier, `null` sans palmarès. `teamModes` ne liste que les équipes où le joueur a aussi un palmarès 1v1/2v2 compté — objet vide pour un joueur purement 3v3. `lans` liste les LAN (voir `lans.json`) où il a un palmarès compté, 3v3 et/ou 1v1/2v2 confondus.

`teams.json`
```json
{ "id": "team-vitality", "name": "Team Vitality", "logo": "logos/team-vitality.png" }
```

`lans.json`
```json
{
  "id": "rlcs-2022-23-world-championship",
  "name": "RLCS 2022-23 - World Championship",
  "date": "2023-08-03",
  "city": "Düsseldorf",
  "country": "de"
}
```

Uniquement les évènements S-Tier `type: "Offline"` (table `tournament`) où au moins un joueur du roster a un palmarès compté — les splits/qualifs en ligne n'y figurent pas, même tier S.

`img` et `logo` sont des chemins locaux, ou `null` quand l'image manque — le
front gère ce cas.

## Licence des données

Les données et images viennent de Liquipedia, sous **CC-BY-SA 3.0**.
L'attribution est déjà présente dans le pied de page de `index.html` ; elle doit
y rester.
