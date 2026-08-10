# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler sur ce dépôt.

"RLGuessr — Guess the Rocket League Pro" — un jeu de quiz statique en HTML/CSS/JS pur permettant de deviner des joueurs RLCS professionnels à partir de leur historique d'équipes, leur drapeau et leurs achievements. Aucune dépendance, aucun bundler, aucun framework. Non affilié à Psyonix/Epic.

Les données de jeu sont **générées depuis l'API Liquipedia** par un script Python hors-ligne (`tools/build_data.py`) — voir « Données » plus bas. Le site servi, lui, reste strictement statique et ne connaît ni l'API ni la clé.

## Langue

- **Texte affiché à l'utilisateur : en anglais**, sans exception (libellés, boutons, messages, `alt`/`title`).
- **Commentaires du code : en français**, ainsi que cette doc, à la demande du mainteneur.

## Lancement

Ouvrir `index.html` directement dans un navigateur, ou servir le dossier avec n'importe quel serveur de fichiers statiques (le launch config VS Code dans `.vscode/launch.json` ouvre `index.html` dans Chrome). Aucune commande de build, lint ou test — la seule commande du projet est la régénération des données (`python tools/build_data.py`, voir plus bas), qui n'est pas nécessaire pour lancer le jeu.

Attention : `players.json` et `teams.json` sont chargés via `fetch()`, donc **un serveur statique est nécessaire** pour tester réellement le jeu — la plupart des navigateurs refusent les `fetch` en `file://`. Dans ce cas le hub affiche désormais `#hubStatus` en rouge avec la marche à suivre, au lieu de laisser les boutons sans effet.

**Règle** : aucun handler de bouton ne doit se terminer par un `return` silencieux. `startMode()` sans données affiche un message via `setHubStatus()` — un bouton qui ne fait rien est indiscernable d'un bouton cassé.

## Déploiement

Production : **Apache2 sur Raspberry Pi**, en fichiers statiques. Pas d'installation, pas de service, pas de commande à lancer côté serveur.

**Contrainte non négociable : rien de ce qui est déployé ne doit exiger un runtime.** Pas de PHP, pas de Node, pas de cron, pas de Python côté serveur. Si une évolution semble réclamer du code serveur, c'est le signe qu'elle doit se faire à la génération, sur le poste du mainteneur.

Séparation des deux moitiés du projet :

| Sur le poste du mainteneur (Windows) | Copié sur la Pi |
|---|---|
| `tools/` — le générateur Python | `index.html`, `script.js`, `style.css` |
| `docs/` — la spec API | `players.json`, `teams.json` *(générés)* |
| `.env` — **la clé API, jamais copiée** | `image/` — favicon et icônes sociales |
| | `players_img/` — les photos *(à la main)* |
| | `logos/` — les logos d'équipes *(générés)* |

`tools/` et `docs/` n'ont rien à faire dans le docroot, mais ils n'y cassent rien.

`.env` est le seul fichier réellement sensible : Apache le servirait en clair. Il est gitignoré, donc **un déploiement qui passe par le dépôt ne peut pas l'emporter** ; **une copie brute du dossier (rsync, scp, clé USB) le prendrait avec elle.** C'est ce point-là qu'il faut vérifier avant de choisir où mettre la clé.

Le dossier déployé pèse **~23 Mo** : 16 Mo de `logos/` (893 fichiers, générés), 6,6 Mo de `players_img/` (maintenus à la main), le reste ~700 Ko. Les deux dossiers d'images **doivent être déployés** — voir « Images » plus bas.

## Ressources externes

**Aucune image de contenu n'est chargée depuis un domaine tiers** — voir « Images » plus bas pour la raison. Domaines tiers restants :
- `flagcdn.com` — les drapeaux
- Google Fonts (`Archivo Black`, `Barlow Condensed`, `Barlow`) — la typographie du design
- `googletagmanager.com` — Google Analytics

`image/` (favicon, icônes sociales), `players_img/` (les photos) et `logos/` (les logos) sont tous servis localement.

Les images et données Liquipedia sont sous **CC-BY-SA 3.0** : l'attribution dans le pied de page de `index.html` est obligatoire, ne pas la retirer.

### Sécurité côté front

Le site n'a ni secret ni contenu utilisateur reflété (tout vient de `players.json`/`teams.json`/`lans.json`, générés à froid — voir « Données » plus bas), donc la surface XSS réelle est déjà quasi nulle : le rendu passe partout par `textContent`/propriétés DOM, jamais `innerHTML` avec une valeur qui ne soit pas un littéral codé en dur. La CSP posée en `<meta>` dans `index.html` est donc de la défense en profondeur, pas un correctif à un trou constaté.

Deux limites à connaître avant d'y toucher :
- **`script-src` garde `'unsafe-inline'`.** Le hub s'appuie sur une trentaine d'attributs `onclick`/`onkeydown`/`onchange` (`index.html`) plutôt que sur `addEventListener` : les retirer casserait toute la CSP si on enlevait `'unsafe-inline'` en même temps. Migrer vers `addEventListener` pour pouvoir durcir `script-src` est un chantier à part, pas fait ici — mécanique mais touche la plupart des boutons du hub, à faire en une passe dédiée et testée bouton par bouton.
- **`frame-ancestors` n'a pas sa place dans le `<meta>`** : la spec CSP l'ignore silencieusement (avec `report-uri` et `sandbox`) quand la policy est livrée par balise plutôt que par en-tête HTTP. La vraie protection anti-clickjacking est le header `X-Frame-Options` posé dans `.htaccess`, avec la même réserve `AllowOverride` que le reste de ce fichier (voir son en-tête).

Si `players.json`/`teams.json` chargent un jour depuis un autre domaine, ou qu'une image/logo passe par une URL non contrôlée, penser à élargir `img-src`/`connect-src` en conséquence — sinon la CSP bloque silencieusement le chargement (pas d'erreur visible pour le joueur, seulement dans la console).

## Architecture

Tout est piloté par `script.js` sur les éléments DOM déclarés dans `index.html` et stylisés dans `style.css`. Pas de framework, module system, ni router — toutes les fonctions et l'état mutable (`players`, `teams`, `remainingPlayers`, `currentPlayer`, `selectedMode`, `roundResolved`, etc.) sont globaux. Les éléments DOM sont mis en cache dans des constantes en haut du script (pattern `const elXxx = document.getElementById(...)`).

### Les trois vues

`index.html` contient trois blocs concurrents, basculés par des classes (pas de router) :

| Vue | Élément | Affichage piloté par |
|---|---|---|
| Hub (accueil + choix du mode) | `#hub` | `.leaving` (fondu de sortie) puis `.hidden` |
| Jeu | `#game` | `.active` |
| Écran de victoire | `#endScreen` | `.show` |

`startMode()` fait hub → jeu, `goBackToMenu()` fait l'inverse, `showEndScreen()` superpose l'écran de fin.

<<<<<<< HEAD
=======
### Routing (URL et back/forward)

Bien qu'il n'y ait qu'un `index.html`, le mode courant est **persisté dans le hash de l'URL** : `#/mode/classic`, `#/mode/lan/rlcs-2026-paris-major`, `#/mode/era/after`, `#/mode/region/mena`, etc. Back/forward du navigateur naviguent entre le hub et les modes, et un lien avec hash (ex. `rlguessr.com#/mode/lan/rlcs-2026-paris-major`) démarre directement dans ce mode une fois les données chargées.

**Pourquoi hash-based et pas History API avec de vraies URLs** : une vraie URL demanderait un rewrite Apache pour servir `index.html` sur n'importe quel chemin, et Raspberry Pi OS met `AllowOverride None` sur `/var/www` par défaut (voir « Déploiement » plus haut). Le hash reste côté client, aucun changement serveur nécessaire — cohérent avec la contrainte non négociable « rien de ce qui est déployé ne doit exiger un runtime ».

Format des hashes (voir section « Routing » dans `script.js`) :
- Hub : pas de hash (URL propre)
- Modes classiques : `#/mode/{classic|medium|hard|extreme|timer}`
- Earnings Rank : `#/mode/earnings` (sans le count 5/10 — c'est un réglage de session, pas un paramètre à partager)
- Career Era : `#/mode/era/{before|after}`
- Regional Scene : `#/mode/region/{slug}` (voir `REGION_SLUGS` dans `script.js` — les slugs sont stabilisés, pas dérivés à la volée : `Asia-Pacific` → `asia-pacific`, `MENA` → `mena`, etc.)
- Quick Ten : `#/mode/quickten`
- LAN Roster : `#/mode/lan/{lan.id}` (les ids de LAN sont déjà des slugs, cf. `lans.json`)

**Deux invariants à conserver** :

1. **Utiliser `history.pushState()`, jamais `location.hash =`.** `pushState()` met à jour l'URL sans déclencher `hashchange`, ce qui évite la boucle « on navigue → hashchange → on renavigue ». Les écouteurs `popstate`/`hashchange` ne réagissent alors qu'aux vraies actions utilisateur (back/forward, édition manuelle de l'URL).

2. **Le guard `applyingRoute` reste indispensable.** Quand `popstate` déclenche `applyRoute()`, on appelle `startXxx()`/`goBackToMenu()` — qui appellent eux-mêmes `pushRoute()`. Sans le guard, on entasserait une entrée d'historique en double à chaque back/forward. À toucher ce chemin, vérifier que le guard couvre toujours l'appel.

**Ajouter un mode** : penser à câbler `pushRoute("nom-du-mode"[, param])` juste avant l'appel `enterGameScreen(...)` dans le `startXxx()`, et à ajouter la branche correspondante dans le `switch` d'`applyRoute()`. Si le mode a un paramètre (comme LAN ou region), il doit aussi restaurer la valeur du filtre + mettre à jour l'UI du contrôle sur le hub (`select.value = ...`), sinon un back du navigateur relance le mode mais le hub n'a plus la bonne sélection affichée.

**Le count 5/10 d'Earnings Rank et le period pill de Career Era ne sont PAS dans l'URL** pour des raisons différentes :
- Earnings Rank : le count est un simple réglage local, on n'a pas voulu le porter dans une URL partageable
- Career Era : c'est DÉJÀ dans le path (`/era/before` vs `/era/after`), pas dans un query — deux entrées d'historique distinctes, comme deux modes séparés

>>>>>>> 6d64bad (v6)
### Design

Le design vient d'un projet Claude Design importé (`RLGuessr.dc.html`) : hub avec héros « RL / GUESSR » en dégradé, cartes de mode colorées, vue de jeu en deux colonnes, carte de victoire. Le fichier source est un composant de prévisualisation React/DC — **rien de son JS n'est repris**, seuls la mise en page et le langage visuel ont été portés en CSS classique.

**Contrainte non négociable du hub** : les cinq cartes de mode sont le seul élément actionnable de la page d'accueil, elles doivent être **entièrement visibles et cliquables sans défiler** sur un portable 1366×768. Le portage initial du design plaçait la grille à y=561 avec un héros de 432 px, ce qui rejetait la carte Timer hors écran (y=792) et donnait l'impression que les boutons ne répondaient plus. Deux mécanismes maintiennent l'invariant :
- toutes les hauteurs du héros sont plafonnées en `vh` autant qu'en `vw` (`padding: clamp(20px, 4.5vh, 48px) …`, titre en `clamp(44px, min(7.5vw, 13vh), 104px)`)
- au-delà de 1120 px la grille passe en `repeat(5, 1fr)`, une seule rangée

Après toute retouche du héros ou des cartes, revérifier à 1366×768 **et** 1280×720 que les cinq cartes tiennent au-dessus de la ligne de flottaison.

**Le titre « RL / GUESSR » et le mode sombre automatique de Chrome.** Le titre est un dégradé découpé à la forme des lettres (`background-clip: text` + texte transparent). Quand Chrome applique son mode sombre automatique à la page, il réécrit les couleurs *et* n'honore plus le découpage : le texte reste transparent par-dessus un aplat, et il ne reste que deux bandes de couleur à la place du titre. Trois protections, à conserver ensemble :
- `color-scheme: dark` (dans `:root` **et** en `<meta>`) : la page se déclare déjà sombre, Chrome n'y touche plus. C'est le correctif de fond.
- `width: fit-content` sur `.hero-rl` / `.hero-guessr` : sans lui les blocs font toute la largeur du hub, donc l'aplat barre la page entière au lieu de tenir dans le mot.
- `checkGradientTextSupport()` dans `script.js` : compare la valeur **calculée** de `background-clip` à `text` et bascule en couleur pleine (`.no-gradient-text`) si elle ne correspond pas. `@supports` ne suffit pas — le navigateur annonce le support puis ne l'applique pas.

Conventions CSS à respecter :
- Les couleurs d'accent sont des **triplets RGB** dans `:root` (`--blue: 0, 148, 255`) pour être réutilisables en `rgba(var(--blue), .35)`
- Chaque carte de mode définit `--c` / `--c-lt` ; les règles génériques de `.mode-card` en dérivent toutes les nuances
- `[hidden] { display: none !important; }` est indispensable : plusieurs blocs masqués via l'attribut `hidden` portent un `display` explicite qui l'emporterait sinon

### Données

**`players.json` et `teams.json` sont générés — ne jamais les éditer à la main.** Toute modification manuelle sera écrasée au prochain run du générateur. La documentation complète du pipeline est dans `tools/README.md`.

Tout vient de l'API v3 **sauf les photos**, et c'est une contrainte subie, pas un choix :

| Donnée | Source | Pourquoi |
|---|---|---|
| Joueurs, nationalité | API v3 `player` | — |
| Historique d'équipes | API v3 `squadplayer` | — |
| Nom des équipes, URL des logos | API v3 `team` | les fichiers eux-mêmes sont ensuite **téléchargés** : voir « Images » |
| Palmarès S-Tier | API v3 `placement` | — |
| **Photos de joueurs** | **dossier local `players_img/`** | la table `player` de l'API v3 **n'expose ni `image` ni `imageurl`** sur le wiki `rocketleague` — vérifié champ par champ. Les portraits du wiki ne sont pas exploitables en production. |

### Images

**Liquipedia bloque le hotlinking.** Vérifié à la main : la même URL de logo renvoie `HTTP 200` sans en-tête `Referer`, et `HTTP 403` avec un `Referer` venant d'un autre domaine — le 403 sert une petite image d'erreur, pas le logo. Un site tiers ne peut donc **pas** pointer vers leur CDN, et ce piège est silencieux : les images « chargent » (`naturalWidth > 0`), elles affichent simplement l'image de refus. Toutes à la même taille — c'est le signe qui trahit le problème.

Conséquence : `download_logos()` rapatrie chaque logo dans `logos/` en fin de génération, et `teams.json` ne contient que des chemins locaux. Le téléchargement n'envoie aucun `Referer` (urllib n'en met pas), donc il passe. Les fichiers déjà présents ne sont pas retéléchargés : seules les nouvelles équipes coûtent quelque chose.

Les vignettes sont demandées en **120 px**. Liquipedia ne génère pas toutes les largeurs à la demande : 400 (la valeur servie par l'API), 120, 100 et 50 répondent ; 150, 200 et 250 renvoient des 404. Ne pas changer cette valeur sans revérifier ce qui existe réellement.

**Pour vérifier que des logos s'affichent, ne pas se contenter de `naturalWidth > 0`** : compter les dimensions *distinctes*. Des images toutes identiques signalent qu'on sert une image d'erreur.

### Photos

`players_img/` est, avec `tools/roster.txt`, **le second élément maintenu à la main** — et il doit être déployé. Le générateur ne fait que rapprocher chaque tag du roster d'un fichier, via `local_photos()`, en trois passes :

1. correspondance exacte du nom normalisé (`zen` → `zen.webp`) ;
2. l'un est préfixe de l'autre, pour les noms de fichiers tronqués (`chausette45` → `chausette.webp`, `ASN_RuBiiX` → `asn.webp`) ;
3. plus long préfixe commun d'au moins 6 caractères, **à condition qu'il soit sans ambiguïté** (`Zanejackey` → `zanejacket.webp`).

Le seuil de 6 caractères et la règle d'unicité ne sont pas décoratifs : en dessous, le générateur attribuerait la photo d'un autre joueur. Ajouter un joueur = une ligne dans `roster.txt` **et** un fichier dans `players_img/` ; les tags sans photo sont listés en fin de run.

Schéma produit :
- `players.json` : `{ name, img, teams: [teamId...], teamModes: {teamId: [mode...]}, country, countryName, region, achievements, firstSTierDate, lastSTierDate, lans: [lanId...], earnings, liquipedia }`
- `earnings` : gains cumulés en carrière, en USD, tels que remontés par `player.earnings` sur l'API v3 (entier arrondi, `0` si absent). Sert au mode de test « Earnings Rank » — voir « Modes de test » plus bas ; aucun mode principal ne s'en sert
- `firstSTierDate` / `lastSTierDate` : date (`AAAA-MM-JJ`) du premier et du dernier palmarès S-Tier du joueur, ou `null` sans palmarès. Calculées à partir des dates déjà récupérées pour trier `achievements` (voir `fetch_achievements()` dans `tools/build_data.py`) — aucun appel API dédié. Suffisent à départager n'importe quelle coupure unique (« a un palmarès avant/après telle date ») sans garder la date de chaque palmarès individuel ; servent au mode de test « Career Era »
- `region` : l'une de sept valeurs (`Europe`, `North America`, `South America`, `MENA`, `SSA`, `Asia-Pacific`, `Oceania`), ou `null` si non reconnue. C'est l'**affiliation compétitive actuelle** du joueur (`player.region` sur l'API v3), **pas sa nationalité** — un joueur marocain jouant en Europe vaut `region: "Europe"`. Normalisée par `tools/regions.py` : le champ brut de l'API est du texte libre non uniforme (« Middle East » et « MENA » pour la même zone, « Asia » et « Asia-Pacific », une fiche avec du markup wiki brut au lieu d'un texte propre) — voir le mapping `REGION_MAP` pour le détail. Sert au mode de test « Regional Scene » ; contrairement à `teams`, c'est une valeur unique (l'affiliation du moment), pas un historique
- `teamModes` : sous-ensemble de `teams` — uniquement les équipes où le joueur a *aussi* un palmarès 1v1 et/ou 2v2 compté (voir `achievements` ci-dessous), ex. `{ "team-vitality": ["1v1", "2v2"] }`. Sert au badge sur les tuiles d'équipe, voir plus bas « L'historique d'équipes n'est pas filtré ». Absent (objet vide) pour un joueur purement 3v3 — c'est l'affiliation par défaut, elle ne se marque pas
- `achievements` inclut désormais le podium (1er/2e/3e, y compris ex æquo type « 3rd - 4th ») des qualifications régionales 1v1/2v2 (« Opens », ex. « RLCS 2026: Europe 2v2 Open ») en plus des places habituelles en finale — voir `PODIUM_MODES` dans `tools/build_data.py`. Le 3v3 garde son exclusion stricte des qualifs : les inclure sans filtre noierait le palmarès (des centaines de qualifs régionales mineures)
- `lans` : liste d'identifiants (voir `lans.json` ci-dessous) des LAN où le joueur a un palmarès compté — 3v3 et/ou 1v1/2v2 confondus, un Major et son volet 1v1/2v2 comptant comme la même LAN. Sert au mode de test « LAN Roster »
- `teams.json` : `{ id, name, logo }` — `id` est un slug dérivé du nom (`team-vitality`), pas un entier
- `lans.json` : `{ id, name, date, city, country }` — uniquement les évènements S-Tier `type: "Offline"` (une vraie LAN, pas un split/qualif en ligne) où au moins un joueur du roster a un palmarès compté. `id` est un slug dérivé de `name` (ex. `rlcs-2026-paris-major`)
- `img` et `logo` sont des **chemins relatifs** (`players_img/…`, `logos/…`), ou `null` quand l'image manque. Le front gère les deux cas (voir « Photo du joueur » et les tuiles d'équipe en mode texte)
- Les trois fichiers sont fetchés une seule fois au chargement de la page (`Promise.all`)
- `country` est un code minuscule pour `https://flagcdn.com/{code}.svg` — ISO 3166-1 (`fr`, `us`) **et** subdivisions ISO 3166-2 (`gb-eng`, `gb-sct`, `gb-wls`), l'endpoint SVG étant le seul à servir les subdivisions
- `countryName` est le libellé anglais prêt à afficher, fourni par le générateur : plus aucune table de pays n'est maintenue dans `script.js`
- Le tableau `teams` d'un joueur est ordonné chronologiquement (par `joindate` Liquipedia) — cet ordre compte pour le mode "extreme"

**L'historique d'équipes n'est pas filtré, c'est délibéré.** `squadplayer` remonte *tous* les passages : sélections nationales (« Team France »), équipes amateur, piges courtes. D'où ~893 équipes contre ~200 dans l'ancienne liste faite à la main. Le choix assumé est la fidélité à Liquipedia plutôt qu'une sélection éditoriale codée en dur. En contrepartie, beaucoup de logos sont obscurs : **chaque tuile porte un `title` avec le nom complet de l'équipe** (`script.js`, `tile.title = team.name`) — ne pas le retirer, c'est ce qui rend ces logos déchiffrables. Une info-bulle CSS stylée n'est pas possible en l'état : `.panel` porte `overflow: hidden` et rognerait la bulle sur la première rangée de tuiles.

**Badge 1v1/2v2.** Une tuile d'équipe porte un badge `1V1`/`2V2`/`1V1/2V2` en haut à droite (`.team-tile-mode`, coin opposé au badge ordinal `.team-tile-order`) quand `player.teamModes[teamId]` existe — c'est-à-dire quand ce passage inclut un palmarès solo/duo compté pour cette équipe, en plus (ou à la place) d'un rôle 3v3. Le 3v3 reste sans marque : c'est l'affiliation par défaut. Un duo 2v2 ad-hoc (ex. « La Chienneté », deux joueurs d'organisations différentes associés pour un tournoi) n'a ni logo ni page dédiée sur Liquipedia — le badge se pose donc sur la VRAIE équipe de chaque joueur (`p{n}team` sur le placement), pas sur une tuile inventée pour le duo. Si cette équipe n'apparaît pas déjà dans `teams` (org jouée en 1v1/2v2 mais jamais rejointe officiellement selon `squadplayer`), le badge est perdu plutôt que d'ajouter une tuile sans logo ni historique — voir `fetch_achievements()`/`placement_owner_teams()` dans `tools/build_data.py`.

Les photos Liquipedia sont des photos de presse en **paysage** ~3:2, d'où le `object-fit: cover` + `object-position: 50% 28%` sur `#playerPhoto` pour garder le visage dans un cadre carré.

### Régénérer les données (API Liquipedia)

```bash
python tools/build_data.py --dry-run    # vérifier le rapport
python tools/build_data.py              # écrire players.json + teams.json
```

- Trois emplacements possibles pour la clé, par ordre de priorité de lecture : la variable d'environnement `LIQUIPEDIA_API_KEY`, `~/.liquipedia-api-key`, puis `.env` à la racine. **`.env` est gitignoré** : sûr si le déploiement passe par le dépôt, à éviter si le dossier est copié tel quel. Les deux premiers sont hors du projet et restent sûrs dans tous les cas.
- La clé ne doit jamais apparaître dans `script.js`, `index.html`, un `.json` servi, ou un fichier commité — tout ce que sert le site est public, et la doc Liquipedia l'interdit explicitement.
- `.htaccess` bloque `.env`, `.py` et `.md` en défense en profondeur, mais Raspberry Pi OS met `AllowOverride None` sur `/var/www` par défaut : **ne pas compter dessus**. La vraie protection est que la clé n'atteigne jamais le serveur.
- C'est pour cette raison que l'appel API est **hors-ligne, à la génération** et pas à l'exécution dans le navigateur : un site statique ne peut pas garder un secret. Ne pas « simplifier » en déplaçant les appels dans `script.js`.
- **`tools/roster.txt` est le seul fichier de données maintenu à la main** : un tag de joueur par ligne. Ajouter ou retirer un joueur = éditer ce fichier puis relancer le script. Photo, drapeau, équipes, logos et palmarès suivent tout seuls.
- `tools/aliases.json` sert de rattrapage quand un tag n'est pas résolu automatiquement (`tag → pagename Liquipedia exact`).
- `tools/.cache/` mémorise les réponses brutes : les relances sont gratuites. `--fresh` pour vraiment retaper l'API.
- Stdlib Python uniquement (3.8+), aucune dépendance à installer. Le site, lui, n'a toujours aucune étape de build.

**Quota : l'API v3 limite les requêtes PAR TABLE**, et `team` est la première saturée (~900 équipes à résoudre pour 200 joueurs). Une fois le quota épuisé, l'API répond 429 jusqu'à réinitialisation de la fenêtre — il n'y a qu'à attendre, pas à contourner. Deux conséquences pratiques :
- **`tools/.cache/` est la vraie protection, pas un confort.** Ne pas le vider et ne pas lancer `--fresh` sans nécessité.
- Ne pas changer la taille des lots dans `fetch_teams()` : elle détermine les clés de cache, et la modifier invalide d'un coup tout le cache `team` déjà constitué.

Liquipedia **répète la clé API en clair dans ses messages d'erreur de quota**. `Client._redact()` la masque dans tout ce qui est journalisé ou levé en exception — ne pas retirer ce masquage, sans lui la clé finit dans les logs de build.

### Flux de jeu

1. `startMode(mode)` : fondu hub → jeu, configure le HUD/timer, rend la carte d'indices, appelle `startGame()`
2. `startGame()` : tire un joueur aléatoire depuis `remainingPlayers`, remplit la fiche (drapeau + pays, achievements, tuiles d'équipes, chips de comptage, `#playerIndex`), précharge la photo du joueur courant + un futur joueur aléatoire pour fluidifier les transitions
3. `checkAnswer()` : normalise (minuscules, trim, sans accents) et compare avec `currentPlayer.name`
4. `skipQuestion()` : révèle la réponse sans créditer une bonne réponse
5. `revealPlayer(type)` : charge la photo et attend `onload` avant de l'afficher (voir « ghosting » plus bas) ; `type` vaut `correct` ou `skip` et colore la lueur du cadre
6. `lockRound()` : `roundResolved = true`, désactive input/boutons, affiche `#nextBtn`
7. `nextPlayer()` → `startGame()` : boucle jusqu'à ce que `remainingPlayers` soit vide → `showEndScreen()`

`roundResolved` garde `checkAnswer()`/`skipQuestion()` idempotents après résolution, et fait basculer la touche Entrée de « valider » à « joueur suivant ».

### Modes de jeu

Contrairement aux versions précédentes, **la configuration des modes est centralisée** dans la table `MODES` en haut de `script.js` :

```js
classic: { name, flag: true,  achievements: true,  teamLimit: 0, timed: false }
```

- `name` — nom affiché dans le HUD, les blocs « masqué en … » et l'écran de fin
- `flag` — affiche le drapeau + le nom du pays, sinon le bloc « Hidden in … mode »
- `achievements` — affiche la liste des titres, sinon le bloc verrouillé
- `teamLimit` — `0` = toutes les équipes ; `n` = n équipes tirées au hasard, re-triées pour conserver l'ordre chronologique, plus la mention « Capped at n »
- `timed` — affiche la pastille Time et pilote `startTimer()`/`stopTimer()`

Les cinq modes : `classic` (tout), `medium` (sans achievements), `hard` (sans nationalité), `extreme` (sans achievements + 2 équipes), `timer` (tout + chrono).

Le chrono **compte en avant** (il ne décompte pas) : il se fige sur bonne réponse/abandon et reprend au `nextPlayer()`. Le design importé proposait un décompte de 120 s ; ce changement de règle n'a pas été retenu.

### Ajouter un mode

1. Ajouter une entrée dans `MODES` (`script.js`)
2. Ajouter une carte `<button class="mode-card mode-xxx" onclick="startMode('xxx')">` dans `#hub` (`index.html`)
3. Ajouter `.mode-xxx { --c: …; --c-lt: …; }` (`style.css`)

Aucune autre fonction n'a besoin d'être touchée : `startGame()`, `fillInfoCard()` et `renderClueList()` lisent tous `modeConfig()`.

### Modes de test

Section séparée du hub, sous les cinq modes principaux (affichée « Specials » — le nom interne reste « Test modes » dans le code : classes CSS `test-mode-grid`/`section-head-test`, ce commentaire) : des mini-jeux à l'essai, gardés ou retirés selon le retour du mainteneur. Ils **ne passent pas par la table `MODES`** — celle-ci n'a de sens que pour le mécanisme « deviner le nom à partir d'indices » des cinq modes ci-dessus. Chaque mode de test a sa propre carte dans `#hub` et ses propres fonctions `startXxx()` — pas de branchement dans `startMode()`. Deux patrons selon que la mécanique de jeu est inédite ou non :

- **Mécanique inédite** → son propre écran (un `<div class="game">` de plus, parallèle à `#game`, basculé par la même classe `.active`), ses propres fonctions `startXxx()`/`nextXxxRound()`. Exemple : **Earnings Rank** (`startEarningsMode()`, écran `#rankGame`). Tire 5 ou 10 joueurs au hasard parmi ceux avec `earnings > 0`, les affiche en ordre mélangé (photo + tag, aucun autre indice) ; le joueur les tapote dans l'ordre qu'il pense être décroissant par gains. Au dernier tap, `resolveRankRound()` réordonne les cartes selon le classement réel (`style.order` CSS, la grille est déjà en `display: grid`) et colore chaque carte selon que la pioche du joueur à cette position correspondait. `goBackToMenu()` doit repasser aussi `#rankGame` en non-actif — à faire pour tout nouvel écran de mode de test.
- **Même mécanique « deviner à partir d'indices » que les modes classiques, juste un pool de joueurs différent** → pas de nouvel écran, on réutilise `#game`. Deux exemples :
  - **Career Era** (`startEraMode()`). Bascule entre deux périodes de carrière (« Before Season X » / « After Season X », toggle sur la carte du hub, cf. `eraPeriod`) et filtre `players` sur `firstSTierDate`/`lastSTierDate` (voir le schéma de `players.json` plus haut) avant d'appeler `setupGame(mode, { pool, displayName })` — `mode` vaut `"era-before"`/`"era-after"`, absent de `MODES`, donc `modeConfig()` retombe sur `MODES.classic` (tous les indices affichés, palmarès complet même hors période). `setupGame()` accepte cet `options.pool`/`options.displayName` précisément pour ce cas : sans eux, `#playerIndex`, `restartMode()` et l'écran de fin repartiraient sur le roster complet au lieu du pool filtré. Le dropdown du HUD liste ses deux périodes séparément (2 options, ça tient).
  - **Regional Scene** (`startRegionMode()`). Filtre `players` sur `region` (sept zones, cf. `regionFilter` choisi via un `<select>` sur la carte du hub plutôt qu'un toggle — sept pastilles auraient surchargé la carte). Même mécanique que Career Era (`setupGame("region", { pool, displayName })`), mais `mode` reste la constante `"region"` quelle que soit la zone choisie : contrairement aux deux entrées de Career Era, les sept zones tiennent dans **une seule** entrée de dropdown (comme Earnings Rank, qui ne liste pas séparément ses tailles 5/10) — pas besoin d'une clé par zone pour la mettre en surbrillance.
  - **Quick Ten** (`startQuickTenMode()`). Tire 10 joueurs au hasard (`drawRandomPool()`) dans tout le roster, pas de filtre. La série épuise `remainingPlayers` en 10 manches, ce qui déclenche `showEndScreen()` — l'écran de fin des modes classiques sert tel quel de récapitulatif, aucun nouvel écran à construire. Seule nouveauté par rapport à Career Era/Regional Scene : leur pool est un ensemble stable (toutes les équipes/joueurs éligibles), rejouer le même à l'identique sur « Play Again » est correct ; celui de Quick Ten est un tirage aléatoire, donc rejouer *les mêmes dix* serait surprenant. `setupGame()` accepte pour ça un troisième champ, `options.resample` (fonction sans argument qui retire un nouveau pool), lu par `restartMode()` — nul pour tous les autres modes, qui gardent leur comportement `[...currentPool]` inchangé. Sa carte hub est un `<div role="button">` comme les trois autres, **pas** un `<button>` malgré l'absence de contrôle imbriqué : dans la grille `.test-mode-grid`, Chrome décale le contenu d'un `<button>` d'~24 px vers le bas par rapport à ses voisins `<div>` — vérifié via `getBoundingClientRect()` en isolant la variable (même contenu, même classe, seul le tag change). Pas un bug du CSS du site, un comportement de rendu de `<button>` propre à ce contexte de grille ; ne pas réintroduire un `<button>` pour une future carte de ce genre sans revérifier.
  - **LAN Roster** (`startLanMode()`). Filtre `players` sur `lans` (voir le schéma de `players.json` plus haut) — pool égal à tout joueur ayant un palmarès compté (3v3 ou 1v1/2v2) à la LAN choisie. Sept régions tenaient dans un `<select>` codé en dur (Regional Scene) ; 32 LAN ne peuvent pas l'être — `populateLanSelect()` peuple `#lanSelect` depuis `lans.json` une fois chargé, et choisit par défaut la LAN la plus récente (le fichier est déjà trié par date). Comme Regional Scene, `mode` reste la constante `"lan"` quelle que soit la LAN choisie : une seule entrée de dropdown, pas une par LAN.

### Photo du joueur et révélation

La photo est **l'enjeu de la manche** : elle vit dans `#photoSlot` (fiche joueur), masquée par `#photoMask` (silhouette « ? » + shimmer) pendant que le joueur cherche. `revealPlayer()` ajoute `.revealed` au slot, ce qui efface le masque en fondu et fait apparaître `#playerPhoto`. `#photoSil` reçoit l'initiale du pseudo pour rester lisible si l'image ne charge pas.

Tous les joueurs Liquipedia n'ont pas de photo (`img: null`). Dans ce cas `revealPlayer()` ajoute `.no-photo` : le masque **reste** affiché avec l'initiale, la légende « Photo » disparaît et `#playerPhoto` est sorti du rendu (un `src=""` fait afficher une icône d'image cassée dans certains navigateurs). La manche se résout normalement — il ne doit jamais y avoir de cadre vide.

Il n'y a plus d'overlay de révélation plein écran ni d'image fixée sur le côté droit — le design importé place la révélation dans la fiche.

### Affichage de la nationalité

`fillInfoCard()` affiche à la fois une image drapeau (`#infoFlag`) et un nom de pays en texte (`#infoCountryName`), côte à côte. Le `src` du drapeau utilise `https://flagcdn.com/{code}.svg` (endpoint SVG — obligatoire pour les subdivisions ; l'endpoint `w80/{code}.png` ne sert PAS les drapeaux de subdivisions). Si le drapeau échoue au chargement (`onerror`), l'image est masquée et le nom en texte continue de communiquer la nationalité. Quand `flag: false` (mode `hard`), tout le bloc `#infoNationality` est masqué et `#flagMasked` prend sa place.

Le nom affiché est `player.countryName` (fourni par le générateur). `countryName(code)` n'est plus qu'un **repli** et ne contient plus de table écrite à la main : il s'appuie sur `Intl.DisplayNames` pour tout l'ISO 3166-1, et sur `SUBDIVISION_NAMES` (4 entrées) pour les nations britanniques qu'`Intl` ne connaît pas. Un nouveau pays ne demande donc **aucune modification de `script.js`** — seulement, si la nationalité Liquipedia est inconnue du mapping, une entrée dans `tools/countries.py` (elle ressort dans `players_without_country` du rapport de build).

### Carte d'indices

`renderClueList()` reconstruit `#clueList` à chaque `startMode()` à partir de `modeConfig()` : une ligne par indice avec un badge `on` / `off` / `partial`. La ligne « Player photo » est toujours `partial` (« On reveal ») puisque la photo n'est jamais un indice, seulement la récompense.

### Préchargement des images

`preloadImage(url)` crée un `Image()` et le stocke dans `preloadedImages[]` (évite que certains navigateurs annulent le chargement). Dans `startGame()`, deux préchargements sont effectués :
1. La photo du joueur **courant** (immédiatement après sa sélection)
2. La photo + les logos d'un futur joueur aléatoire (pour la manche suivante)

### Bug corrigé : ghosting de l'image précédente

**Problème** : l'ancienne photo restait visible quelques millisecondes lors de la révélation du joueur suivant. Cause double :
- Le `src` de l'image était changé directement, mais la texture GPU de l'ancienne image restait décodée jusqu'à ce que la nouvelle soit prête
- La classe déclenchant la transition CSS `opacity 0→1` était ajoutée immédiatement, révélant l'ancienne image

**Correction** :
- `resetPhotoSlot()` vide le `src` (`""`) et retire `.revealed` en début de manche
- Dans `revealPlayer()`, après avoir défini le nouveau `src`, l'affichage attend `onload` (ou vérifie `img.complete && img.naturalWidth > 0` si l'image est déjà en cache). `onerror` déclenche aussi l'affichage pour éviter un blocage sur image manquante.
