# Guess the Rocket League Pro

A fan-made browser quiz game where you guess RLCS professional Rocket League players from their team history, nationality flag, and S-tier achievements.

> **Disclaimer:** This is an unofficial fan project and is not affiliated with, endorsed by, or connected to Psyonix or Epic Games in any way.

## Features

- Guess pro players based on their career team logos, nationality flag, and achievements
- Five difficulty modes, plus five experimental "Specials" mini-modes
- Score tracker (correct / total guesses)
- Accent-insensitive answer matching (e.g. "Vatira" works for "Vatïra")
- Image preloading for smooth transitions between players
- Fully responsive — works on desktop and mobile

## Game Modes

| Mode | Teams | Flag | Achievements | Timer |
|------|-------|------|--------------|-------|
| **Classic** | All | Shown | Shown | No |
| **Medium** | All | Shown | Hidden | No |
| **Hard** | All | Hidden | Shown | No |
| **Extreme** | 2 max (random, chronological order) | Shown | Hidden | No |
| **Timer** | All | Shown | Shown | Yes (counts up) |

### Specials

Experimental modes, shown separately on the hub — kept or dropped based on
feedback. All five reuse Classic's full clue set unless noted otherwise.

| Mode | What it does |
|------|--------------|
| **Earnings Rank** | No clues but face + tag. Rank 5 or 10 random pros from highest to lowest career earnings. |
| **Career Era** | Roster filtered to players active before or after RLCS Season X. |
| **Regional Scene** | Roster filtered to one of seven regions (Europe, North America, South America, MENA, SSA, Asia-Pacific, Oceania) — a player's *current* competitive affiliation, not their nationality. |
| **Quick Ten** | A short run of 10 random players, then a recap screen and a fresh set. |
| **LAN Roster** | Pick a LAN (Paris Major, Worlds 2023, …) and guess everyone who competed there — 3v3, 1v1 and 2v2 combined. |

## Tech Stack

- Plain HTML5 / CSS3 / Vanilla JavaScript — zero dependencies, no build step
- Data: `players.json` + `teams.json` + `lans.json` fetched at runtime
- Team names, nationalities, regions, achievements and LAN events: [Liquipedia DB API v3](https://api.liquipedia.net/documentation/api/v3), pulled offline by `tools/build_data.py`
- Team logos: downloaded into `logos/` by the generator — **Liquipedia blocks hotlinking** (403 on any cross-origin `Referer`), so they have to be self-hosted
- Player photos: the local `players_img/` folder — the v3 `player` table exposes no image field at all
- Country flags: [flagcdn.com](https://flagcdn.com)
- Team tiles carry a small **1v1/2v2 badge** when a player also has a solo/duo result for that team, on top of (or instead of) a regular 3v3 role

Both image folders are served from your own domain and **must be deployed**.
The deployed folder is ~21 MB: 13 MB of `logos/` (generated), 6.4 MB of
`players_img/` (hand-maintained), ~1.5 MB for everything else.

Liquipedia data and images are used under **CC-BY-SA 3.0**.

## Running Locally

```bash
# Option 1 — open directly
open index.html   # macOS
start index.html  # Windows

# Option 2 — any static file server
npx serve .
python -m http.server 8080
```

No install, no build. The VS Code launch config (`.vscode/launch.json`) opens `index.html` in Chrome automatically.

## Deploying

The site is **plain static files** — copy the folder into your web server's
document root and you're done. No runtime, no PHP, no Node, nothing to install
or start on the server.

Copy these:

```
index.html  script.js  style.css  players.json  teams.json  lans.json  image/  players_img/  logos/
```

`tools/` and `docs/` are development-only — harmless in a document root, just
unused. **`.env` holds your API key and must never reach the server.** It is
gitignored, so a repository-based deployment cannot carry it; a plain copy of
the folder would.

## Data

`players.json`, `teams.json`, `lans.json` and the `logos/` folder are
**generated** from the Liquipedia API — do not edit them by hand.

```bash
python tools/build_data.py --dry-run   # check the report first
python tools/build_data.py             # regenerates players.json + teams.json + lans.json
```

The v3 API rate-limits **per table**, and `team` is the one that runs out first
(~900 teams for a 200-player roster). If you hit `HTTP 429 … limits … exceeded`,
just wait for the window to reset and run again — `tools/.cache/` keeps every
response already fetched, so a rerun resumes instead of starting over. Avoid
`--fresh` unless you really mean it.

Put your Liquipedia API key in a `.env` file at the project root:

```
LIQUIPEDIA_API_KEY=your_key_here
```

`.env` is gitignored, so it stays out of the repository. The
`LIQUIPEDIA_API_KEY` environment variable and `~/.liquipedia-api-key` also work,
and both live outside the project folder — prefer one of those if you deploy by
copying the folder, since a copy would carry `.env` along.

The key is only ever read by the generator, on your machine. It never reaches
the browser: the deployed site is pure static files.

Full documentation: [`tools/README.md`](tools/README.md).

## Adding a Player

Add the player's tag on its own line in `tools/roster.txt`, drop their photo
into `players_img/` (naming it after the tag), then run
`python tools/build_data.py`. Flag, team history, logos and S-tier achievements
are fetched automatically; the photo is matched from the folder. Any tag left
without a photo is listed at the end of the run.

## Project Structure

```
index.html          Main page
script.js           All game logic (single file, no modules)
style.css           All styles
players.json        Player data      (generated)
teams.json          Team data        (generated)
lans.json           LAN event data   (generated)
tools/              Liquipedia API data generator
  roster.txt        The player list — hand-maintained
  aliases.json      Manual tag -> Liquipedia pagename overrides
  build_data.py     Roster -> players.json + teams.json + lans.json
  liquipedia.py     API v3 client (key, throttle, retry, cache)
  countries.py      Nationality -> flagcdn country code
  regions.py        Competitive region -> one of seven zones
players_img/        Player photos — hand-maintained, one file per roster tag
logos/              Team logos    (generated — downloaded from Liquipedia)
image/              UI assets (favicon, social icons)
docs/               Liquipedia API reference
```
