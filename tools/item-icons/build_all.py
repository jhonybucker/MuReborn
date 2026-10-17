"""Gera os ícones de TODOS os itens equipáveis do cliente 99b em site/public/images/items/.

Uso: python tools/item-icons/build_all.py "<cliente>/Data" [--out site/public/images/items]

Nomes dos arquivos gerados:
- <grupo>-<indice>.webp para armas, escudos, asas e conjuntos (é o que a API manda em "group"/"index");
- nome-do-item.webp para anéis, colares e pets, cujo grupo/índice varia entre servidores.

Regra dos modelos: prefixo do tipo + (índice + 1). Conjuntos de elfa (índices 10 a 14) usam "Elf"
(Elf01 = índice 10). Conjuntos do Magic Gladiator não têm elmo, por isso faltam HelmMale16/21/24.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from render_items import load_bmd, render  # noqa: E402

WEAPON_GROUPS = {"sword": 0, "axe": 1, "mace": 2, "spear": 3, "staff": 5, "shield": 6, "wing": 12}
SET_GROUPS = {"helm": 7, "armor": 8, "pant": 9, "glove": 10, "boot": 11}

# Arcos (grupo 4) não seguem a regra simples: flechas e bestas ocupam índices intermediários.
BOWS = {
    **{f"bow{n:02d}": n - 1 for n in range(1, 8)},  # 0–6 arcos
    "arrows01": 7,
    **{f"crossbow{n:02d}": 7 + n for n in range(1, 8)},  # 8–14 bestas
    "arrows02": 15,
    "crossbow17": 16,
    "bow18": 17,
    "bow19": 18,
    "bow20": 19,
}

# Anéis, colares e pets: identificados pela aparência do modelo; salvos pelo nome do item.
NAMED = {
    "agnecklace": "pendant-of-ability",
    "icenecklace": "pendant-of-ice",
    "windnecklace": "pendant-of-wind",
    "waternecklace": "pendant-of-water",
    "necklace01": "pendant-of-lighting",
    "necklace02": "pendant-of-fire",
    "groundring": "ring-of-earth",
    "windring": "ring-of-wind",
    "firering": "ring-of-fire",
    "manaring": "ring-of-magic",
    "waterring": "ring-of-ice",
    "ring02": "ring-of-poison",
    "magicring00": "transformation-ring",
}


def plan(data: Path) -> list[tuple[Path, str]]:
    jobs: list[tuple[Path, str]] = []
    for file in sorted((data / "Item").glob("*.bmd"), key=lambda f: f.name.lower()):
        stem = file.stem.lower()
        if stem in NAMED:
            jobs.append((file, NAMED[stem]))
            continue
        if stem in BOWS:
            jobs.append((file, f"4-{BOWS[stem]}"))
            continue
        match = re.fullmatch(r"([a-z]+)(\d{2})", stem)
        if match and match.group(1) in WEAPON_GROUPS:
            jobs.append((file, f"{WEAPON_GROUPS[match.group(1)]}-{int(match.group(2)) - 1}"))
    for file in sorted((data / "Player").glob("*.bmd"), key=lambda f: f.name.lower()):
        stem = file.stem.lower()
        match = re.fullmatch(r"(helm|armor|pant|glove|boot)(male|elf)(\d{2})", stem)
        if match:
            kind, body, number = match.group(1), match.group(2), int(match.group(3))
            index = number - 1 if body == "male" else 9 + number
            jobs.append((file, f"{SET_GROUPS[kind]}-{index}"))
        elif stem == "angel":
            jobs.append((file, "guardian-angel"))
    return jobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("data", type=Path, help="pasta Data do cliente")
    parser.add_argument("--out", type=Path, default=Path("site/public/images/items"))
    parser.add_argument("--size", type=int, default=256)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    failures = []
    jobs = plan(args.data)
    for number, (file, name) in enumerate(jobs, 1):
        try:
            image = render(
                load_bmd(file),
                file.parent,
                args.size,
                horizontal=file.stem.lower().startswith("wing"),
                upright=file.parent.name.lower() == "player",
            )
            image.save(args.out / f"{name}.webp", "WEBP", quality=85)
            print(f"[{number}/{len(jobs)}] {file.name} -> {name}.webp")
        except Exception as error:  # um modelo ruim não para o lote
            failures.append(f"{file.name}: {error}")
    if failures:
        print("\nFalharam:", *failures, sep="\n  ", file=sys.stderr)
    print(f"\n{len(jobs) - len(failures)} ícones gerados, {len(failures)} falhas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
