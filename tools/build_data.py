"""Genere players.json et teams.json depuis l'API Liquipedia DB v3.

    python tools/build_data.py            # generation complete
    python tools/build_data.py --dry-run  # n'ecrit rien, affiche le rapport
    python tools/build_data.py --fresh    # ignore le cache disque
    python tools/build_data.py --probe player   # dump brut d'un endpoint

Seul tools/roster.txt est maintenu a la main (la liste des tags a inclure).
Tout le reste — nationalite, photo, historique d'equipes, logos, palmares —
vient de l'API.

La cle API est lue dans .env (racine du projet) ou dans la variable
d'environnement LIQUIPEDIA_API_KEY. Elle n'est jamais ecrite dans les
fichiers generes : le site reste 100% statique et sans secret.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import countries
import regions
from liquipedia import (ApiError, Client, ROOT, USER_AGENT, chunked,
                        load_api_key, or_conditions)

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ROSTER_FILE = os.path.join(TOOLS_DIR, "roster.txt")
ALIASES_FILE = os.path.join(TOOLS_DIR, "aliases.json")
REPORT_FILE = os.path.join(TOOLS_DIR, "build-report.json")

PLAYERS_OUT = os.path.join(ROOT, "players.json")
TEAMS_OUT = os.path.join(ROOT, "teams.json")
LANS_OUT = os.path.join(ROOT, "lans.json")

# Tier 1 = S-Tier sur le wiki Rocket League.
S_TIER = "1"

# Types de tournoi qui ne comptent pas comme un palmares.
EXCLUDED_TIER_TYPES = {"qualifier", "showmatch", "charity", "points", "misc"}

# Exception a EXCLUDED_TIER_TYPES : les qualifs regionales 1v1/2v2 ("Opens",
# ex. "RLCS 2026: Europe 2v2 Open") sont tres nombreuses et noieraient le
# palmares si on les traitait comme les Splits 3v3 (toute place comptee).
# On ne garde donc que le podium, uniquement pour ces deux modes.
PODIUM_MODES = {"1v1", "2v2"}

# Roles a exclure de l'historique d'equipes : on veut le parcours de joueur.
EXCLUDED_ROLES = {"coach", "manager", "analyst", "assistant coach",
                  "head coach", "streamer", "content creator", "owner",
                  "substitute coach"}

# Champs demandes a l'API. Si un champ disparait cote Liquipedia, le client
# rejoue la requete sans `query` plutot que d'echouer (voir get_lenient).
#
# Attention : ces listes ont ete verifiees champ par champ contre le wiki
# rocketleague. Les colonnes inexistantes ne sont pas ignorees par l'API, elles
# font echouer toute la requete en HTTP 404. Notamment :
#   - `player` n'a ni `image` ni `imageurl` (photos : voir wiki_images.py),
#     et le nom localise s'appelle `localizedname`, pas `romanizedname` ;
#   - `squadplayer` n'a pas de `teampagename` : la page de l'equipe est
#     `pagename`, et `link` est la page du joueur.
PLAYER_FIELDS = "id,pagename,name,localizedname,alternateid,nationality,type,status,earnings,region"
SQUAD_FIELDS = "link,pagename,name,teamtemplate,joindate,leavedate,position,role"
PLACEMENT_FIELDS = "pagename,tournament,placement,date,liquipediatier,liquipediatiertype,opponentplayers,opponentname,opponenttype,mode"
LAN_FIELDS = "pagename,name,mode,type,startdate,locations,liquipediatier"


# ============================================================
# Utilitaires
# ============================================================

def norm_key(value):
    """Cle de rapprochement : minuscules, sans accent, sans rien hors [a-z0-9].

    Permet de faire correspondre le roster ecrit a la main ("vatira",
    "fairy peak") aux libelles Liquipedia ("Vatira", "Fairy Peak!").
    """
    if not value:
        return ""

    # On coupe la parenthese de desambiguisation des pagenames Liquipedia
    # ("Zen (French player)" -> "Zen").
    value = re.sub(r"\s*\([^)]*\)\s*$", "", str(value))
    value = value.replace("_", " ")

    # Les accents sont decomposes puis retires : "Vatira" == "Vatira".
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))

    return re.sub(r"[^a-z0-9]+", "", value.lower())


def slug(value):
    """Identifiant d'equipe stable et lisible, utilise comme cle dans teams.json."""
    out = re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")
    return out or "team"


def pick(row, *keys):
    """Premiere valeur non vide parmi plusieurs noms de champ possibles."""
    for key in keys:
        value = row.get(key)
        if isinstance(value, str):
            value = value.strip()
        if value:
            return value
    return None


def absolute_url(url):
    """Normalise les URLs d'images renvoyees par l'API en URL absolue https."""
    if not url:
        return None

    url = str(url).strip()
    if not url:
        return None

    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://liquipedia.net" + url
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    if url.startswith("https://"):
        return url

    return None


ORDINAL_SUFFIX = {1: "st", 2: "nd", 3: "rd"}


def ordinal(number):
    if 10 <= number % 100 <= 20:
        return f"{number}th"
    return f"{number}{ORDINAL_SUFFIX.get(number % 10, 'th')}"


def format_placement(raw):
    """'1' -> '1st' ; '3-4' -> '3rd - 4th'. None si la place n'est pas un rang."""
    if not raw:
        return None

    raw = str(raw).strip()
    parts = [p.strip() for p in raw.split("-") if p.strip()]

    if not parts or not all(p.isdigit() for p in parts):
        return None  # W / L / DQ / DNP

    return " - ".join(ordinal(int(p)) for p in parts)


def is_podium(raw):
    """Vrai si le meilleur rang de `raw` (placement brut, avant mise en
    forme) est 1er, 2e ou 3e — sert a filtrer les qualifs 1v1/2v2, voir
    PODIUM_MODES."""
    if not raw:
        return False

    first = str(raw).strip().split("-")[0].strip()
    return first.isdigit() and int(first) <= 3


def get_lenient(client, endpoint, params):
    """Appel API qui rejoue sans filtre de champs si `query` est refuse."""
    try:
        return client.get(endpoint, params)
    except ApiError as exc:
        # Un depassement de quota n'a rien a voir avec les champs demandes :
        # rejouer la requete ne ferait que consommer un appel de plus.
        if "query" not in params or "exceeded" in str(exc).lower():
            raise
        client.log(f"    ! {exc}")
        client.log("    -> nouvelle tentative sans filtre de champs")
        fallback = dict(params)
        fallback.pop("query")
        return client.get(endpoint, fallback)


# ============================================================
# Etape 1 — roster
# ============================================================

def load_roster():
    if not os.path.isfile(ROSTER_FILE):
        raise SystemExit(f"Roster introuvable : {ROSTER_FILE}")

    tags = []
    seen = set()

    with open(ROSTER_FILE, encoding="utf-8") as fh:
        for line in fh:
            tag = line.strip()
            if not tag or tag.startswith("#"):
                continue
            if norm_key(tag) in seen:
                continue
            seen.add(norm_key(tag))
            tags.append(tag)

    return tags


def load_aliases():
    """tools/aliases.json : { "tag du roster": "Pagename Liquipedia" }."""
    if not os.path.isfile(ALIASES_FILE):
        return {}

    with open(ALIASES_FILE, encoding="utf-8") as fh:
        raw = json.load(fh)

    return {norm_key(k): v for k, v in raw.items()
            if v and not k.startswith("_")}


# ============================================================
# Etape 2 — table player
# ============================================================

def fetch_player_index(client):
    """Telecharge la table player du wiki et l'indexe par cle normalisee."""
    client.log("[1/8] Table des joueurs")

    rows = client.paginate("player", {"query": PLAYER_FIELDS}, page_size=1000)

    index = defaultdict(list)

    for row in rows:
        for candidate in (row.get("id"), row.get("pagename"), row.get("name"),
                          row.get("localizedname"), row.get("alternateid")):
            key = norm_key(candidate)
            if key:
                index[key].append(row)

    client.log(f"    {len(rows)} joueurs indexes sous {len(index)} cles")
    return index


def score_candidate(row):
    """Departage les homonymes : gains d'abord, puis le type de fiche.

    La photo ne peut pas servir d'arbitre ici : la table player ne la porte
    pas (elle est resolue plus tard, page par page, dans wiki_images.py).
    """
    score = 0

    try:
        score += min(50, float(row.get("earnings") or 0) / 10000.0)
    except (TypeError, ValueError):
        pass

    if (row.get("type") or "").lower() == "player":
        score += 10

    return score


def resolve_roster(client, tags, index, aliases):
    """Associe chaque tag du roster a une ligne de la table player."""
    resolved = {}
    missing = []
    ambiguous = []

    for tag in tags:
        key = norm_key(aliases.get(norm_key(tag), tag))
        candidates = index.get(key) or []

        if not candidates:
            missing.append(tag)
            continue

        if len(candidates) > 1:
            unique_pages = {c.get("pagename") for c in candidates}
            if len(unique_pages) > 1:
                ambiguous.append({"tag": tag, "pages": sorted(unique_pages)})

        best = max(candidates, key=score_candidate)
        resolved[tag] = best

    client.log(f"    {len(resolved)}/{len(tags)} tags resolus")

    if missing:
        client.log(f"    ! {len(missing)} non trouves : {', '.join(missing)}")
        client.log(f"    -> ajouter le pagename exact dans {ALIASES_FILE}")

    return resolved, missing, ambiguous


# ============================================================
# Etape 3 — historique d'equipes (squadplayer)
# ============================================================

def fetch_team_history(client, resolved):
    """{pagename joueur: [teamtemplate, ...]} dans l'ordre chronologique."""
    client.log("[2/8] Historique d'equipes")

    # `squadplayer.link` porte le titre avec des espaces ("M0nkey M00n"), pas
    # le pagename souligne ("M0nkey_M00n") : filtrer sur ce dernier ne remonte
    # rien du tout, et le joueur ressort sans aucune equipe.
    pages = sorted({row.get("pagename").replace("_", " ")
                    for row in resolved.values() if row.get("pagename")})

    stints = defaultdict(list)

    for batch in chunked(pages, 25):
        rows = get_lenient(client, "squadplayer", {
            "conditions": or_conditions("link", batch),
            "query": SQUAD_FIELDS,
            "order": "joindate ASC",
            "limit": 1000,
        })

        for row in rows:
            role = (pick(row, "role", "position") or "").strip().lower()
            if role in EXCLUDED_ROLES:
                continue

            template = pick(row, "teamtemplate")
            # Dans squadplayer, `pagename` est la page de l'EQUIPE (le squad est
            # liste sur la page de l'equipe) et `link` celle du joueur.
            team_page = pick(row, "pagename")
            if not template and not team_page:
                continue

            # Surtout pas de repli sur `pagename` : ce serait l'equipe.
            owner = norm_key(pick(row, "link"))
            if not owner:
                continue
            stints[owner].append({
                "template": template,
                "teampagename": team_page,
                "joindate": pick(row, "joindate") or "",
            })

        client.log(f"    {len(batch)} joueurs -> {len(rows)} passages")

    # Ordre chronologique, une entree par equipe (premiere arrivee conservee).
    history = {}

    for owner, entries in stints.items():
        entries.sort(key=lambda e: (e["joindate"] or "9999-99-99"))

        ordered = []
        seen = set()

        for entry in entries:
            key = norm_key(entry["template"] or entry["teampagename"])
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(entry)

        history[owner] = ordered

    return history


# ============================================================
# Etape 4 — nom et logo des equipes (team)
# ============================================================

TEAM_FIELDS = "pagename,name,template,logourl,logodarkurl,textlesslogourl,textlesslogodarkurl"


def fetch_teams(client, history):
    """{cle normalisee: {name, logo}} pour les seules equipes du roster.

    On interroge `team` page par page d'equipe plutot que `teamtemplatelist` :
    le wiki compte plus de 12 000 templates (la pagination n'etait meme pas
    arrivee a la lettre « d » au bout de 60 pages), alors que le roster ne
    traverse que quelques centaines d'equipes.
    """
    client.log("[3/8] Equipes (noms et logos)")

    pages = sorted({stint["teampagename"] for entries in history.values()
                    for stint in entries if stint.get("teampagename")})

    teams = {}

    # L'API applique un quota PAR TABLE et `team` est la plus vite saturee :
    # une fois le quota epuise, il faut attendre sa fenetre de reset. Le cache
    # disque est donc la vraie protection ici — ne pas changer cette taille de
    # lot sans raison, elle invalide tout le cache `team` deja constitue.
    for batch in chunked(pages, 25):
        rows = get_lenient(client, "team", {
            "conditions": or_conditions("pagename", batch),
            "query": TEAM_FIELDS,
            "limit": 1000,
        })

        for row in rows:
            if not row:
                continue

            page = pick(row, "pagename")
            display = pick(row, "name", "pagename")

            if not page:
                continue

            # Le site est sur fond sombre : la variante "dark" de Liquipedia
            # est celle concue pour ces fonds, on la prefere quand elle existe.
            logo = (absolute_url(pick(row, "logodarkurl"))
                    or absolute_url(pick(row, "logourl"))
                    or absolute_url(pick(row, "textlesslogodarkurl"))
                    or absolute_url(pick(row, "textlesslogourl")))

            entry = {"name": str(display).replace("_", " "), "logo": logo}

            # Indexe sous la page ET sous le template : l'historique retient
            # l'un ou l'autre selon les lignes squadplayer.
            for key in {norm_key(page), norm_key(pick(row, "template"))}:
                if not key:
                    continue
                existing = teams.get(key)
                # On garde la variante qui a un logo.
                if existing and existing.get("logo") and not logo:
                    continue
                teams[key] = entry

        client.log(f"    {len(batch)} pages -> {len(teams)} cles")

    return teams


# ============================================================
# Etape 5 — palmares S-Tier (placement)
# ============================================================

def fetch_achievements(client, resolved):
    """{cle joueur: [chaine de palmares, ...]} triee par date,
    {cle joueur: (premiere_date, derniere_date)} pour le mode de test
    "Career Era" (avant/apres RLCS Season X, voir CLAUDE.md) — ces deux
    dates suffisent a departager n'importe quelle coupure unique, pas besoin
    de garder la date de chaque palmares individuel,
    {cle joueur: {nom_equipe_normalise: {"1v1", "2v2"}}} pour le badge de
    mode sur les tuiles d'equipe (voir "Badge 1v1/2v2" dans CLAUDE.md), et
    {cle joueur: {pagename_tournoi, ...}} pour resoudre les LAN auxquelles
    chaque joueur a participe (voir fetch_lans(), "Mode LAN" dans CLAUDE.md)."""
    client.log("[4/8] Palmares S-Tier")

    pages = sorted({row.get("pagename") for row in resolved.values()
                    if row.get("pagename")})
    wanted = {norm_key(p) for p in pages}

    found = defaultdict(list)
    team_modes = defaultdict(lambda: defaultdict(set))
    owner_pages = defaultdict(set)

    for batch in chunked(pages, 8):
        terms = []
        for page in batch:
            terms.extend(f"[[opponentplayers_p{slot}::{page}]]"
                         for slot in range(1, 6))

        rows = get_lenient(client, "placement", {
            "conditions": f"({' OR '.join(terms)}) AND [[liquipediatier::{S_TIER}]]",
            "query": PLACEMENT_FIELDS,
            "order": "date ASC",
            "limit": 1000,
        })

        for row in rows:
            tier_type = (pick(row, "liquipediatiertype") or "").strip().lower()
            mode = (pick(row, "mode") or "").strip().lower()

            if tier_type in EXCLUDED_TIER_TYPES:
                # Exception : un podium en qualif 1v1/2v2 (Open regional)
                # compte quand meme — voir PODIUM_MODES. Le 3v3 garde
                # l'exclusion stricte.
                is_qualifier_podium = (
                    tier_type == "qualifier"
                    and mode in PODIUM_MODES
                    and is_podium(pick(row, "placement"))
                )
                if not is_qualifier_podium:
                    continue

            place = format_placement(pick(row, "placement"))
            tournament = pick(row, "tournament", "pagename")
            if not place or not tournament:
                continue

            tournament = str(tournament).replace("_", " ")
            label = f"{place} {tournament}"
            date = pick(row, "date") or ""

            tournament_page = pick(row, "pagename")

            for owner in placement_owners(row):
                if owner in wanted:
                    found[owner].append((date, label))
                    if tournament_page:
                        owner_pages[owner].add(tournament_page)

            if mode in PODIUM_MODES:
                for owner, team_name in placement_owner_teams(row):
                    if owner in wanted:
                        team_modes[owner][norm_key(team_name)].add(mode)

        client.log(f"    {len(batch)} joueurs -> {len(rows)} placements")

    achievements = {}
    era_bounds = {}

    for owner, entries in found.items():
        entries.sort(key=lambda e: e[0])

        ordered = []
        seen = set()

        for _, label in entries:
            if label in seen:
                continue
            seen.add(label)
            ordered.append(label)

        achievements[owner] = ordered
        # entries est deja trie par date : le premier et le dernier suffisent.
        era_bounds[owner] = (entries[0][0][:10], entries[-1][0][:10])

    return achievements, era_bounds, team_modes, owner_pages


def placement_owners(row):
    """Cles normalisees des joueurs cites dans le champ opponentplayers."""
    players = row.get("opponentplayers")

    if isinstance(players, str):
        try:
            players = json.loads(players)
        except (TypeError, ValueError):
            return []

    if not isinstance(players, dict):
        return []

    owners = []

    for key, value in players.items():
        # p1, p2, p3... ; on ignore p1dn (display name), p1flag, etc.
        if re.fullmatch(r"p\d+", str(key)) and value:
            owners.append(norm_key(value))

    return owners


def placement_owner_teams(row):
    """[(cle_joueur_normalisee, nom_equipe), ...] — l'equipe que CE joueur
    representait sur CE placement (champ p{n}team). En 1v1/2v2, chaque
    joueur garde sa propre equipe meme quand `opponentname` est un duo
    ad-hoc sans logo ni page dediee (ex. deux joueurs d'orgas differentes
    associes pour un Open 2v2) — voir "Palmares 1v1/2v2" dans CLAUDE.md."""
    players = row.get("opponentplayers")

    if isinstance(players, str):
        try:
            players = json.loads(players)
        except (TypeError, ValueError):
            return []

    if not isinstance(players, dict):
        return []

    pairs = []

    for key, value in players.items():
        m = re.fullmatch(r"p(\d+)", str(key))
        if m and value:
            team = players.get(f"p{m.group(1)}team")
            if team:
                pairs.append((norm_key(value), str(team)))

    return pairs


# ============================================================
# Etape 5 — LAN (mode de test "LAN Roster")
# ============================================================

def fetch_lans(client, pagenames):
    """{lan_id: {id, name, date, city, country}} pour les evenements
    physiques (`type: "Offline"`) parmi `pagenames`, et {pagename: lan_id}
    pour relier chaque placement (3v3, 1v1 ou 2v2) a sa LAN.

    Le 3v3 et son eventuel volet 1v1/2v2 sont deux pages Liquipedia
    distinctes pour le MEME evenement physique (verifie a la main : memes
    dates, meme ville) — elles ne different que par un segment `/1v1/` ou
    `/2v2/` dans le pagename (".../2025/Raleigh_Major" et
    ".../2025/1v1/Raleigh_Major"). On les regroupe donc sous une seule
    entree LAN, nommee d'apres la page 3v3 quand elle existe dans le
    groupe. Voir "Mode LAN" dans CLAUDE.md.
    """
    client.log("[5/8] LAN (evenements offline)")

    pages = sorted({p for p in pagenames if p})
    rows_by_page = {}

    for batch in chunked(pages, 25):
        rows = get_lenient(client, "tournament", {
            "conditions": or_conditions("pagename", batch),
            "query": LAN_FIELDS,
            "limit": 100,
        })

        for row in rows:
            page = pick(row, "pagename")
            if page:
                rows_by_page[page] = row

        client.log(f"    {len(batch)} tournois -> {len(rows)} trouves")

    offline = {page: row for page, row in rows_by_page.items()
               if row.get("type") == "Offline"}

    def canonical(pagename):
        # Retire le segment /1v1/ ou /2v2/, au milieu du chemin ou a la fin.
        return re.sub(r"/(1v1|2v2)(/|$)", r"\2", pagename).rstrip("/")

    groups = defaultdict(list)
    for page, row in offline.items():
        groups[canonical(page)].append(row)

    lans = {}
    page_to_lan = {}

    for rows in groups.values():
        primary = next((r for r in rows if r.get("mode") == "3v3"), rows[0])
        name = str(pick(primary, "name") or "").strip()
        if not name:
            continue

        lan_id = slug(name)

        locations = primary.get("locations") or {}
        if isinstance(locations, str):
            try:
                locations = json.loads(locations)
            except (TypeError, ValueError):
                locations = {}

        lans[lan_id] = {
            "id": lan_id,
            "name": name,
            "date": pick(primary, "startdate") or "",
            "city": locations.get("city1") or "",
            "country": locations.get("country1") or "",
        }

        for row in rows:
            page_to_lan[row.get("pagename")] = lan_id

    return lans, page_to_lan


# ============================================================
# Etape 7 — photos de joueurs (dossier local players_img/)
# ============================================================

PHOTOS_DIR = os.path.join(ROOT, "players_img")

# Longueur minimale d'un prefixe commun pour rapprocher un tag d'un fichier.
# En dessous, le risque d'attribuer la photo d'un autre joueur devient reel.
MIN_COMMON_PREFIX = 6


def common_prefix_len(a, b):
    length = 0
    for ca, cb in zip(a, b):
        if ca != cb:
            break
        length += 1
    return length


def local_photos(client, tags):
    """{cle joueur: 'players_img/xxx.webp'} depuis le dossier local.

    Les photos NE viennent PAS de l'API : la table `player` de l'API v3
    n'expose aucun champ image, et les portraits du wiki ne sont pas
    exploitables en production. Le dossier `players_img/` est donc la source,
    maintenue a la main a cote de `roster.txt`.

    Les noms de fichiers historiques sont souvent tronques ou abreges
    (`chausette45` -> `chausette.webp`, `Zanejackey` -> `zanejacket.webp`),
    d'ou les trois niveaux de rapprochement.
    """
    client.log("[6/8] Photos de joueurs (players_img/)")

    if not os.path.isdir(PHOTOS_DIR):
        client.log(f"    ! dossier introuvable : {PHOTOS_DIR}")
        return {}

    # cle normalisee du nom de fichier -> nom de fichier reel
    files = {}
    for name in sorted(os.listdir(PHOTOS_DIR)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".webp", ".png", ".jpg", ".jpeg"):
            continue
        key = norm_key(stem)
        if key:
            files.setdefault(key, name)

    photos = {}
    unmatched = []

    for tag in tags:
        key = norm_key(tag)
        if not key:
            continue

        # 1. correspondance exacte
        match = files.get(key)

        # 2. l'un est prefixe de l'autre (nom de fichier tronque)
        if not match:
            candidates = [fk for fk in files
                          if fk.startswith(key) or key.startswith(fk)]
            if candidates:
                match = files[max(candidates, key=len)]

        # 3. plus long prefixe commun, a condition qu'il soit sans ambiguite
        if not match:
            scored = [(common_prefix_len(key, fk), fk) for fk in files]
            scored = [(n, fk) for n, fk in scored if n >= MIN_COMMON_PREFIX]
            if scored:
                best = max(n for n, _ in scored)
                tied = [fk for n, fk in scored if n == best]
                if len(tied) == 1:
                    match = files[tied[0]]

        if match:
            photos[key] = f"players_img/{match}"
        else:
            unmatched.append(tag)

    client.log(f"    {len(photos)}/{len(tags)} joueurs avec photo locale")
    if unmatched:
        client.log(f"    ! sans photo : {', '.join(unmatched)}")

    return photos


# ============================================================
# Etape 7 — telechargement des logos
# ============================================================

LOGOS_DIR = os.path.join(ROOT, "logos")

# Liquipedia ne genere pas toutes les largeurs de vignette a la demande :
# 400 (la valeur servie par l'API), 120, 100 et 50 repondent, 150/200/250 non.
# 120 px couvre largement une tuile de 74 px, ecran haute densite compris.
LOGO_WIDTH = 120

# Le CDN refuse les images en 403 des qu'un Referer d'un autre domaine est
# envoye : le site NE PEUT PAS pointer directement dessus, il faut heberger
# les fichiers. urllib n'envoie pas de Referer, le telechargement passe donc.
LOGO_THUMB_RE = re.compile(r"/\d+px-")

# Quand une equipe n'a pas de logo uploade sur Liquipedia, le thumbnailer
# repond quand meme HTTP 200 mais sert un placeholder "fichier manquant" —
# le meme fichier, verifie par hash, sur plus de 200 equipes distinctes.
# Ce n'est PAS le refus 403 lie au hotlinking (voir plus bas) : celui-ci a
# un code HTTP different et n'atteint jamais ce point. Sans cette detection
# le front affiche un logo "generique" identique pour toutes ces equipes
# au lieu du nom — cf. team-tile en mode texte dans script.js.
MISSING_LOGO_SHA1 = {
    "333ffb2cd6e03df902938cb58b7533ad985c5d88",
}


def is_placeholder_logo(data):
    return hashlib.sha1(data).hexdigest() in MISSING_LOGO_SHA1


def download_logos(client, teams_out):
    """Rapatrie les logos dans logos/ et remplace les URLs par des chemins.

    Le site est servi depuis un autre domaine que Liquipedia : hotlinker leur
    CDN renvoie une image d'erreur 403 a la place du logo. On heberge donc.
    Les fichiers deja presents ne sont pas retelecharges, mais sont quand
    meme revalides contre MISSING_LOGO_SHA1 : un fichier deja sur disque
    peut etre un placeholder telecharge avant que cette detection existe.
    """
    client.log("[8/8] Logos d'equipes (telechargement)")

    os.makedirs(LOGOS_DIR, exist_ok=True)

    done = 0
    reused = 0
    placeholder = 0
    failed = []

    for team in teams_out.values():
        url = team.get("logo")
        if not url or not url.startswith("http"):
            continue

        # On demande une vignette plus petite que les 400 px de l'API.
        small = LOGO_THUMB_RE.sub(f"/{LOGO_WIDTH}px-", url)

        ext = os.path.splitext(urllib.parse.urlparse(small).path)[1].lower()
        if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            ext = ".png"

        filename = f"{team['id']}{ext}"
        target = os.path.join(LOGOS_DIR, filename)

        if os.path.isfile(target) and os.path.getsize(target) > 0:
            with open(target, "rb") as fh:
                existing = fh.read()

            if is_placeholder_logo(existing):
                os.remove(target)
                team["logo"] = None
                placeholder += 1
                continue

            team["logo"] = f"logos/{filename}"
            reused += 1
            continue

        data = fetch_binary(client, small) or fetch_binary(client, url)

        if not data:
            failed.append(team["name"])
            team["logo"] = None
            continue

        if is_placeholder_logo(data):
            team["logo"] = None
            placeholder += 1
            continue

        with open(target, "wb") as fh:
            fh.write(data)

        team["logo"] = f"logos/{filename}"
        done += 1

        if done % 50 == 0:
            client.log(f"    {done} telecharges…")

    client.log(f"    {done} telecharges, {reused} deja presents, "
               f"{placeholder} placeholders ecartes, {len(failed)} echecs")

    return failed


def fetch_binary(client, url):
    """Contenu binaire d'une URL, ou None. Aucun Referer n'est envoye."""
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "image/*",
    })

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.read()
    except Exception:  # noqa: BLE001 — un logo manquant n'arrete pas le build
        return None


# ============================================================
# Assemblage
# ============================================================

def build(client, args):
    tags = load_roster()
    aliases = load_aliases()
    client.log(f"Roster : {len(tags)} tags, {len(aliases)} alias")

    index = fetch_player_index(client)
    resolved, missing, ambiguous = resolve_roster(client, tags, index, aliases)

    if not resolved:
        raise SystemExit("Aucun joueur resolu — generation interrompue.")

    history = fetch_team_history(client, resolved)
    templates = fetch_teams(client, history)
    achievements, era_bounds, team_modes, owner_pages = fetch_achievements(client, resolved)

    all_pages = {page for pages in owner_pages.values() for page in pages}
    lans, page_to_lan = fetch_lans(client, all_pages)

    photos = local_photos(client, tags)

    client.log("[7/8] Assemblage")

    teams_out = {}          # id -> {id, name, logo}
    team_id_by_key = {}     # cle template -> id
    players_out = []

    warnings = {
        "no_photo": [],
        "no_country": [],
        "no_teams": [],
        "no_achievements": [],
        "no_region": [],
        "no_logo_teams": set(),
    }

    for tag in tags:
        row = resolved.get(tag)
        if not row:
            continue

        owner = norm_key(row.get("pagename"))

        # --- nationalite ---
        code, country_name = countries.resolve(pick(row, "nationality"))
        if not code:
            warnings["no_country"].append(tag)

        # --- region competitive (affiliation actuelle, pas la nationalite) ---
        # Sert au mode de test "Regional Scene" : region actuelle uniquement,
        # pas d'historique complet (voir CLAUDE.md, "Modes de test").
        region = regions.resolve(pick(row, "region"))
        if not region:
            warnings["no_region"].append(tag)

        # --- photo ---
        # Chemin local relatif : surtout pas absolute_url(), qui ne sait
        # traiter que des URLs et renverrait None.
        photo = photos.get(norm_key(tag))
        if not photo:
            warnings["no_photo"].append(tag)

        # --- equipes ---
        team_ids = []

        for stint in history.get(owner, []):
            # La page de l'equipe est la cle la plus fiable ; le template ne
            # sert que de repli (equipe sans page dediee sur le wiki).
            key = norm_key(stint["teampagename"] or stint["template"])
            template = templates.get(key) or templates.get(norm_key(stint["template"]))

            if template:
                name = template["name"]
                logo = template["logo"]
            else:
                # Template absent du wiki : on garde au moins le nom lisible.
                name = str(stint["teampagename"] or stint["template"]).replace("_", " ")
                logo = None

            team_id = team_id_by_key.get(key)

            if not team_id:
                team_id = slug(name)
                # Deux equipes homonymes ne doivent pas se marcher dessus.
                suffix = 2
                while team_id in teams_out and teams_out[team_id]["name"] != name:
                    team_id = f"{slug(name)}-{suffix}"
                    suffix += 1

                team_id_by_key[key] = team_id
                teams_out.setdefault(team_id, {
                    "id": team_id, "name": name, "logo": logo,
                })

            if not teams_out[team_id]["logo"] and logo:
                teams_out[team_id]["logo"] = logo

            if not logo:
                warnings["no_logo_teams"].add(name)

            if team_id not in team_ids:
                team_ids.append(team_id)

        if not team_ids:
            warnings["no_teams"].append(tag)

        # --- badge 1v1/2v2 sur les tuiles d'equipe ---
        # team_modes[owner] associe un NOM d'equipe (tel que vu sur les
        # placements 1v1/2v2, champ p{n}team) a {"1v1", "2v2"}. On ne le
        # relie a un id que s'il correspond a une equipe deja tracee via
        # squadplayer (comparaison par nom normalise) ; sinon — org jouee en
        # 1v1/2v2 mais jamais rejointe officiellement selon Liquipedia — on
        # l'ignore plutot que d'inventer une tuile sans logo ni historique.
        team_mode_labels = {}
        for team_id in team_ids:
            modes = team_modes.get(owner, {}).get(norm_key(teams_out[team_id]["name"]))
            if modes:
                team_mode_labels[team_id] = sorted(modes)

        # --- LAN (mode de test "LAN Roster") ---
        player_lans = sorted({page_to_lan[page] for page in owner_pages.get(owner, ())
                              if page in page_to_lan})

        # --- palmares ---
        titles = achievements.get(owner, [])
        if not titles:
            warnings["no_achievements"].append(tag)

        # Bornes de carriere S-Tier, pour le mode de test "Career Era"
        # (avant/apres RLCS Season X) — null si aucun palmares.
        bounds = era_bounds.get(owner)
        first_stier_date = bounds[0] if bounds else None
        last_stier_date = bounds[1] if bounds else None

        # --- gains ---
        # Champ agrege de l'API (`player.earnings`), en USD. A la difference
        # du score de desambiguisation ci-dessus, on garde la valeur brute :
        # c'est une donnee de jeu (mode "Earnings Rank"), pas un signal interne.
        try:
            earnings = int(round(float(row.get("earnings") or 0)))
        except (TypeError, ValueError):
            earnings = 0

        if args.require_photo and not photo:
            continue
        if args.require_teams and len(team_ids) < 2:
            continue

        players_out.append({
            "name": tag,
            "img": photo,
            "teams": team_ids,
            "teamModes": team_mode_labels,
            "country": code,
            "countryName": country_name,
            "region": region,
            "achievements": titles,
            "firstSTierDate": first_stier_date,
            "lastSTierDate": last_stier_date,
            "lans": player_lans,
            "earnings": earnings,
            "liquipedia": f"https://liquipedia.net/rocketleague/"
                          f"{str(row.get('pagename') or '').replace(' ', '_')}",
        })

    # Les logos ne peuvent pas etre pointes directement sur le CDN
    # Liquipedia (403 en hotlink) : on les rapatrie ici, une fois les
    # ids d'equipes connus, et teams.json recoit des chemins locaux.
    logo_failures = [] if args.dry_run else download_logos(client, teams_out)

    teams_list = sorted(teams_out.values(), key=lambda t: t["name"].lower())
    lans_list = sorted(lans.values(), key=lambda l: l["date"])

    # LAN sans aucun joueur du roster present : ne pas les proposer dans le
    # selecteur du mode "LAN Roster", ce serait une manche vide.
    lans_with_players = {lid for p in players_out for lid in p["lans"]}
    lans_list = [l for l in lans_list if l["id"] in lans_with_players]

    report = {
        "roster": len(tags),
        "players": len(players_out),
        "teams": len(teams_list),
        "lans": len(lans_list),
        "unresolved_tags": missing,
        "ambiguous_tags": ambiguous,
        "players_without_photo": warnings["no_photo"],
        "players_without_country": warnings["no_country"],
        "players_without_teams": warnings["no_teams"],
        "players_without_achievements": warnings["no_achievements"],
        "players_without_region": warnings["no_region"],
        "teams_without_logo": sorted(warnings["no_logo_teams"]),
        "logo_download_failures": logo_failures,
        "api_requests": client.request_count,
        "cache_hits": client.cache_hits,
    }

    return players_out, teams_list, lans_list, report


def write_json(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def print_report(report):
    print("")
    print("=" * 58)
    print(f"  Joueurs generes  : {report['players']} / {report['roster']}")
    print(f"  Equipes generees : {report['teams']}")
    print(f"  LAN generees     : {report['lans']}")
    print(f"  Requetes API     : {report['api_requests']} "
          f"(+{report['cache_hits']} depuis le cache)")
    print("=" * 58)

    lines = [
        ("Tags non resolus", report["unresolved_tags"]),
        ("Sans photo", report["players_without_photo"]),
        ("Sans nationalite", report["players_without_country"]),
        ("Sans equipe", report["players_without_teams"]),
        ("Sans palmares S-Tier", report["players_without_achievements"]),
        ("Sans region reconnue", report["players_without_region"]),
        ("Equipes sans logo", report["teams_without_logo"]),
    ]

    for label, items in lines:
        if not items:
            continue
        preview = ", ".join(str(i) for i in items[:8])
        more = f" (+{len(items) - 8})" if len(items) > 8 else ""
        print(f"  {label:<22} {len(items):>3}  {preview}{more}")

    if report["ambiguous_tags"]:
        print(f"  {'Homonymes':<22} {len(report['ambiguous_tags']):>3}  "
              "verifier tools/build-report.json")

    print(f"\n  Rapport complet : tools/build-report.json")


def probe(client, endpoint, args):
    """Dump brut des premieres lignes d'un endpoint, pour verifier les champs."""
    params = {"limit": args.probe_limit}
    if args.conditions:
        params["conditions"] = args.conditions

    rows = client.get(endpoint, params)

    print(json.dumps(rows[:args.probe_limit], indent=2, ensure_ascii=False))
    print(f"\n{len(rows)} lignes — champs : "
          f"{sorted({k for r in rows for k in r})}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--wiki", default="rocketleague")
    parser.add_argument("--dry-run", action="store_true",
                        help="n'ecrit ni players.json ni teams.json")
    parser.add_argument("--fresh", action="store_true",
                        help="ignore le cache disque (tools/.cache)")
    parser.add_argument("--throttle", type=float, default=2.0,
                        help="secondes minimum entre deux requetes (defaut 2)")
    parser.add_argument("--require-photo", action="store_true",
                        help="exclut les joueurs sans photo Liquipedia")
    parser.add_argument("--require-teams", action="store_true",
                        help="exclut les joueurs avec moins de 2 equipes")
    parser.add_argument("--probe", metavar="ENDPOINT",
                        help="dump brut d'un endpoint (player, placement, ...)")
    parser.add_argument("--probe-limit", type=int, default=3)
    parser.add_argument("--conditions", help="conditions pour --probe")
    args = parser.parse_args()

    try:
        client = Client(load_api_key(), wiki=args.wiki,
                        throttle=args.throttle, use_cache=not args.fresh)

        if args.probe:
            probe(client, args.probe, args)
            return 0

        players, teams, lans, report = build(client, args)

    except ApiError as exc:
        print(f"\nERREUR API : {exc}", file=sys.stderr)
        return 1

    write_json(REPORT_FILE, report)

    if args.dry_run:
        print_report(report)
        print("\n  --dry-run : aucun fichier de donnees ecrit.")
        return 0

    write_json(PLAYERS_OUT, players)
    write_json(TEAMS_OUT, teams)
    write_json(LANS_OUT, lans)

    print_report(report)
    print(f"\n  Ecrits : players.json ({len(players)}), teams.json ({len(teams)}) "
          f"et lans.json ({len(lans)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
