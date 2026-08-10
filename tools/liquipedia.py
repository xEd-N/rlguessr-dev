"""Client minimal pour l'API Liquipedia DB v3.

Stdlib uniquement (aucun pip install) : urllib + gzip + json.
La cle API n'est jamais ecrite dans un fichier genere ni dans le cache.

Doc : docs/liquipedia-api-guide.md / docs/openapi_liquipedia.json
"""

import gzip
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://api.liquipedia.net/api/v3"

# Liquipedia demande un User-Agent descriptif avec un moyen de contact.
#
# Le contact est en dur ici, et pas dans .env : `_read_env_file()` n'extrait que
# LIQUIPEDIA_API_KEY, donc une ligne LIQUIPEDIA_USER_AGENT posee dans .env
# n'etait jamais lue et on repartait silencieusement sur un defaut anonyme.
# La variable d'environnement, elle, reste prioritaire.
USER_AGENT = os.environ.get(
    "LIQUIPEDIA_USER_AGENT",
    "RLGuessr-DataBuilder/1.0 (static fan quiz; contact: mathysw@pm.me)",
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")


class ApiError(RuntimeError):
    pass


# Emplacement hors du dossier du projet, donc impossible a deployer par
# accident. C'est l'option a retenir si le projet est deploye en COPIANT le
# dossier : un .env pose a la racine finirait alors servi en clair par Apache.
# Si le deploiement part du depot, .gitignore suffit deja a ecarter .env.
HOME_KEY_FILE = os.path.join(os.path.expanduser("~"), ".liquipedia-api-key")


def _read_env_file(path):
    """Extrait LIQUIPEDIA_API_KEY d'un fichier au format .env."""
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            if name.strip() == "LIQUIPEDIA_API_KEY":
                return value.strip().strip("'\"")
    return None


def load_api_key():
    """Cle lue dans l'environnement, puis ~/.liquipedia-api-key, puis .env.

    L'ordre place en tete les sources exterieures au dossier du projet : elles
    restent sûres quel que soit le mode de deploiement. `.env` vient en dernier
    car il n'est a l'abri que si le deploiement part du depot (il est
    gitignore) ; une copie brute du dossier l'emporterait sur le serveur.
    """
    key = os.environ.get("LIQUIPEDIA_API_KEY", "").strip()
    if key:
        return key

    # Fichier du profil utilisateur : soit la cle brute, soit du format .env.
    if os.path.isfile(HOME_KEY_FILE):
        with open(HOME_KEY_FILE, encoding="utf-8") as fh:
            content = fh.read().strip()
        if content:
            return _read_env_file(HOME_KEY_FILE) if "=" in content else content

    env_path = os.path.join(ROOT, ".env")
    if os.path.isfile(env_path):
        key = _read_env_file(env_path)
        if key:
            # Information, pas alerte : .env est gitignore, donc absent du
            # depot. Le seul cas genant est un deploiement par copie brute du
            # dossier, que le script ne peut pas deviner d'ici.
            print(
                "  i cle lue dans .env (gitignore : absent du depot).",
                file=sys.stderr,
            )
            return key

    raise ApiError(
        "Cle API introuvable. Au choix :\n"
        "  - .env a la racine du projet (gitignore) : LIQUIPEDIA_API_KEY=...\n"
        "  - la variable d'environnement LIQUIPEDIA_API_KEY\n"
        f"  - la cle seule dans {HOME_KEY_FILE}, si tu deploies par copie"
    )


class Client:
    """Requetes GET vers l'API, avec throttle, retry 429 et cache disque."""

    def __init__(self, api_key, wiki="rocketleague", throttle=2.0,
                 use_cache=True, verbose=True):
        self.api_key = api_key
        self.wiki = wiki
        self.throttle = throttle
        self.use_cache = use_cache
        self.verbose = verbose
        self.request_count = 0
        self.cache_hits = 0
        self._last_call = 0.0

        if use_cache:
            os.makedirs(CACHE_DIR, exist_ok=True)

    # --- journal ---------------------------------------------------------

    def _redact(self, text):
        """Remplace la cle par un marqueur partout ou elle apparait."""
        if self.api_key and self.api_key in text:
            text = text.replace(self.api_key, "***CLE_API_MASQUEE***")
        return text

    def log(self, message):
        if self.verbose:
            print(self._redact(str(message)), file=sys.stderr, flush=True)

    # --- cache -----------------------------------------------------------

    def _cache_path(self, endpoint, params):
        # La cle API n'entre pas dans l'empreinte : le cache reste anonyme.
        raw = endpoint + "?" + urllib.parse.urlencode(sorted(params.items()))
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
        return os.path.join(CACHE_DIR, f"{endpoint.strip('/')}-{digest}.json")

    # --- requetes --------------------------------------------------------

    def get(self, endpoint, params):
        """Retourne la liste `result` d'un appel. Leve ApiError si echec."""
        params = {k: v for k, v in params.items() if v not in (None, "")}
        params.setdefault("wiki", self.wiki)

        cache_file = self._cache_path(endpoint, params) if self.use_cache else None

        if cache_file and os.path.isfile(cache_file):
            self.cache_hits += 1
            with open(cache_file, encoding="utf-8") as fh:
                return json.load(fh)

        payload = self._fetch(endpoint, params)

        warnings = payload.get("warning") or []
        for warning in warnings:
            self.log(f"    ! warning API : {warning}")

        errors = payload.get("error") or []
        if errors:
            raise ApiError(f"{endpoint} : {'; '.join(str(e) for e in errors)}")

        result = payload.get("result") or []

        if cache_file:
            with open(cache_file, "w", encoding="utf-8") as fh:
                json.dump(result, fh)

        return result

    def _fetch(self, endpoint, params, attempt=1):
        # Throttle : l'API est partagee, on ne la martele pas.
        wait = self.throttle - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)

        url = f"{BASE_URL}/{endpoint.strip('/')}?{urllib.parse.urlencode(params)}"

        request = urllib.request.Request(url, headers={
            "Authorization": f"Apikey {self.api_key}",
            "Accept-Encoding": "gzip",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        })

        self.request_count += 1
        self._last_call = time.monotonic()

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)

        except urllib.error.HTTPError as exc:
            body = exc.read()
            if exc.headers.get("Content-Encoding") == "gzip":
                try:
                    body = gzip.decompress(body)
                except OSError:
                    pass
            # Liquipedia repete la cle en clair dans ses messages de quota :
            # sans ce masquage, elle finit dans les logs de build et dans tout
            # copier-coller de la sortie d'erreur.
            detail = self._redact(body.decode("utf-8", "replace")[:400])

            if exc.code == 429 and attempt <= 5:
                delay = min(60, 5 * (2 ** (attempt - 1)))
                self.log(f"    429 (quota) — nouvelle tentative dans {delay}s")
                time.sleep(delay)
                return self._fetch(endpoint, params, attempt + 1)

            if exc.code == 403:
                raise ApiError(
                    "403 : cle API refusee. Verifier LIQUIPEDIA_API_KEY "
                    f"et l'acces au wiki '{self.wiki}'.\n{detail}"
                ) from exc

            raise ApiError(f"HTTP {exc.code} sur {endpoint}\n{detail}") from exc

        except urllib.error.URLError as exc:
            if attempt <= 3:
                self.log(f"    reseau KO ({exc.reason}) — retry {attempt}/3")
                time.sleep(3 * attempt)
                return self._fetch(endpoint, params, attempt + 1)
            raise ApiError(f"Reseau injoignable : {exc.reason}") from exc

        return json.loads(body.decode("utf-8"))

    def paginate(self, endpoint, params, page_size=1000, max_pages=40):
        """Enchaine les offsets jusqu'a epuisement (ou max_pages)."""
        rows = []

        for page in range(max_pages):
            batch = self.get(endpoint, dict(
                params, limit=page_size, offset=page * page_size))

            rows.extend(batch)
            self.log(f"    page {page + 1} : {len(batch)} lignes (total {len(rows)})")

            if len(batch) < page_size:
                break
        else:
            self.log(f"    ! max_pages={max_pages} atteint sur {endpoint}")

        return rows


def chunked(items, size):
    """Decoupe une liste en tranches de `size` elements."""
    items = list(items)
    for start in range(0, len(items), size):
        yield items[start:start + size]


def or_conditions(field, values):
    """`[[field::a]] OR [[field::b]] ...` — les valeurs sont deja echappees par urlencode."""
    return " OR ".join(f"[[{field}::{value}]]" for value in values)
