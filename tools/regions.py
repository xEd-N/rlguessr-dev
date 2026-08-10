"""Normalisation de `player.region` (API v3) vers les sept zones RLCS
utilisees par le mode de test "Regional Scene" (voir CLAUDE.md).

Le champ est du texte libre entre par les editeurs du wiki, pas un enum
valide : plusieurs libelles designent la meme zone ("Middle East" et
"MENA", "Asia" et "Asia-Pacific"), et au moins une fiche contient du markup
wiki brut ("<span class=\"flag\">...Europe") au lieu d'un texte propre. On
garde donc un mapping explicite plutot que d'utiliser la valeur brute.

Verifie a la main sur le roster courant : "Africa" ne contient que des
joueurs sud-africains (et des transferts depuis d'autres continents), donc
mappe vers SSA plutot que MENA — Liquipedia semble deja ranger l'Afrique
du Nord sous "Middle East"/"MENA".
"""

import re

REGION_MAP = {
    "europe": "Europe",
    "north america": "North America",
    "south america": "South America",
    "oceania": "Oceania",
    "middle east": "MENA",
    "mena": "MENA",
    "africa": "SSA",
    "asia": "Asia-Pacific",
    "asia-pacific": "Asia-Pacific",
}

# Les sept zones, dans l'ordre d'affichage du menu deroulant du site.
REGIONS = [
    "Europe", "North America", "South America",
    "MENA", "SSA", "Asia-Pacific", "Oceania",
]


def _normalize(raw):
    # Retire le markup wiki brut observe sur au moins une fiche (icone de
    # drapeau en <span>/[[File:...]] devant le nom de la region) avant de
    # ne garder que les mots.
    text = re.sub(r"<[^>]+>", " ", str(raw or ""))
    text = re.sub(r"\[\[[^\]]*\]\]", " ", text)
    # Le tiret d'"Asia-Pacific" doit survivre : seuls alnum/espace/tiret restent.
    cleaned = "".join(c.lower() if c.isalnum() or c.isspace() or c == "-" else " "
                      for c in text)
    return " ".join(cleaned.split())


def resolve(raw_region):
    """Bucket normalise (voir REGIONS), ou None si non reconnu."""
    if not raw_region:
        return None
    return REGION_MAP.get(_normalize(raw_region))
