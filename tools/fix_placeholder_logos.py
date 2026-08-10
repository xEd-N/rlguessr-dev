"""Corrige teams.json et logos/ pour les logos "fichier manquant" deja
telecharges avant que download_logos() (build_data.py) sache les detecter.

Purement local : aucun appel reseau, aucune cle API. A relancer si de
nouveaux placeholders se glissent dans logos/ sans repasser par une
generation complete (copie manuelle, vieux cache, etc.).

    python tools/fix_placeholder_logos.py             # applique et ecrit
    python tools/fix_placeholder_logos.py --dry-run    # rapport seulement
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_data import ROOT, is_placeholder_logo, write_json

TEAMS_OUT = os.path.join(ROOT, "teams.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true",
                        help="n'ecrit ni teams.json ni ne supprime de fichier")
    args = parser.parse_args()

    with open(TEAMS_OUT, encoding="utf-8") as fh:
        teams = json.load(fh)

    fixed = []

    for team in teams:
        logo = team.get("logo")
        if not logo:
            continue

        path = os.path.join(ROOT, logo)
        if not os.path.isfile(path):
            continue

        with open(path, "rb") as fh:
            data = fh.read()

        if is_placeholder_logo(data):
            fixed.append((team["id"], logo))
            team["logo"] = None
            if not args.dry_run:
                os.remove(path)

    print(f"{len(fixed)} equipe(s) avec un logo placeholder :")
    for team_id, logo in fixed:
        print(f"  {team_id}  ({logo})")

    if args.dry_run:
        print("\n--dry-run : rien d'ecrit.")
        return

    if fixed:
        write_json(TEAMS_OUT, teams)
        print(f"\nteams.json mis a jour ({len(fixed)} logo(s) mis a null).")


if __name__ == "__main__":
    main()
