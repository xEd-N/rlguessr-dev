"""Conversion des noms de pays Liquipedia vers des codes flagcdn.

Liquipedia renvoie une nationalite en toutes lettres ("France", "England").
Le site a besoin d'un code ISO 3166-1 minuscule, ou d'une subdivision
ISO 3166-2 pour les nations britanniques (gb-eng / gb-sct / gb-wls), les
seules que flagcdn sert via son endpoint SVG.
"""

# Le nom cote gauche est normalise (minuscules, sans ponctuation) avant lookup.
NAME_TO_CODE = {
    "afghanistan": "af", "albania": "al", "algeria": "dz", "andorra": "ad",
    "angola": "ao", "argentina": "ar", "armenia": "am", "australia": "au",
    "austria": "at", "azerbaijan": "az", "bahrain": "bh", "bangladesh": "bd",
    "belarus": "by", "belgium": "be", "bolivia": "bo",
    "bosnia and herzegovina": "ba", "brazil": "br", "bulgaria": "bg",
    "cambodia": "kh", "cameroon": "cm", "canada": "ca", "chile": "cl",
    "china": "cn", "colombia": "co", "costa rica": "cr", "croatia": "hr",
    "cuba": "cu", "cyprus": "cy", "czech republic": "cz", "czechia": "cz",
    "denmark": "dk", "dominican republic": "do", "ecuador": "ec",
    "egypt": "eg", "el salvador": "sv", "england": "gb-eng", "estonia": "ee",
    "finland": "fi", "france": "fr", "georgia": "ge", "germany": "de",
    "ghana": "gh", "greece": "gr", "guatemala": "gt", "honduras": "hn",
    "hong kong": "hk", "hungary": "hu", "iceland": "is", "india": "in",
    "indonesia": "id", "iran": "ir", "iraq": "iq", "ireland": "ie",
    "israel": "il", "italy": "it", "jamaica": "jm", "japan": "jp",
    "jordan": "jo", "kazakhstan": "kz", "kenya": "ke", "kuwait": "kw",
    "kyrgyzstan": "kg", "latvia": "lv", "lebanon": "lb", "libya": "ly",
    "liechtenstein": "li", "lithuania": "lt", "luxembourg": "lu",
    "macau": "mo", "malaysia": "my", "malta": "mt", "mexico": "mx",
    "moldova": "md", "monaco": "mc", "mongolia": "mn", "montenegro": "me",
    "morocco": "ma", "myanmar": "mm", "nepal": "np", "netherlands": "nl",
    "new zealand": "nz", "nicaragua": "ni", "nigeria": "ng",
    "north macedonia": "mk", "northern ireland": "gb-nir", "norway": "no",
    "oman": "om", "pakistan": "pk", "palestine": "ps", "panama": "pa",
    "paraguay": "py", "peru": "pe", "philippines": "ph", "poland": "pl",
    "portugal": "pt", "puerto rico": "pr", "qatar": "qa", "romania": "ro",
    "russia": "ru", "saudi arabia": "sa", "scotland": "gb-sct",
    "senegal": "sn", "serbia": "rs", "singapore": "sg", "slovakia": "sk",
    "slovenia": "si", "south africa": "za", "south korea": "kr",
    "korea": "kr", "spain": "es", "sri lanka": "lk", "sweden": "se",
    "switzerland": "ch", "syria": "sy", "taiwan": "tw", "thailand": "th",
    "tunisia": "tn", "turkey": "tr", "turkiye": "tr", "ukraine": "ua",
    "united arab emirates": "ae", "united kingdom": "gb",
    "united states": "us", "uruguay": "uy", "uzbekistan": "uz",
    "venezuela": "ve", "vietnam": "vn", "wales": "gb-wls", "yemen": "ye",
    "zimbabwe": "zw",
}

# Nom affiche sur le site quand il differe du nom Liquipedia.
DISPLAY_OVERRIDES = {
    "gb-eng": "England",
    "gb-sct": "Scotland",
    "gb-wls": "Wales",
    "gb-nir": "Northern Ireland",
    "us": "United States",
    "gb": "United Kingdom",
}


def _normalize(name):
    cleaned = "".join(c.lower() if c.isalnum() or c.isspace() else " "
                      for c in name)
    return " ".join(cleaned.split())


def resolve(nationality):
    """(code, nom_affiche) — (None, None) si la nationalite est inconnue."""
    if not nationality:
        return None, None

    key = _normalize(nationality)
    code = NAME_TO_CODE.get(key)

    if not code:
        return None, None

    return code, DISPLAY_OVERRIDES.get(code, nationality.strip())
