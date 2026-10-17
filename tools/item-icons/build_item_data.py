"""Extrai os atributos base de todos os itens do cliente 99b para site/lib/item-data.json.

Uso: python tools/item-icons/build_item_data.py "<cliente>/Data/Local/Por/item_por.bmd"

O item_*.bmd tem 512 registros (16 grupos × 32 itens) de 76 bytes, com XOR da chave FC CF AB.
Campos (a partir do byte 30, depois do nome de 30 bytes):
  0 duas mãos · 1 level base · 2 espaço · 3 skill · 4/5 largura/altura · 6/7 dano mín/máx
  8 taxa de defesa · 9 defesa · 10 defesa mágica · 11 velocidade de ataque · 12 velocidade de andar
  13 durabilidade · 14 durabilidade mágica · 15 poder mágico · 16-17 força · 18-19 agilidade
  20-21 energia · 22-23 vitalidade · 24 level exigido
  31-35 classes (DW, DK, Elf, MG, DL; 1 = classe base, 2 = só a evoluída) · 36-42 resistências
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

KEY = bytes([0xFC, 0xCF, 0xAB])
RECORD = 76


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("item_bmd", type=Path)
    parser.add_argument("--out", type=Path, default=Path("site/lib/item-data.json"))
    args = parser.parse_args()

    raw = args.item_bmd.read_bytes()
    items: dict[str, dict] = {}
    for number in range(512):
        chunk = bytes(b ^ KEY[i % 3] for i, b in enumerate(raw[number * RECORD : (number + 1) * RECORD]))
        name = chunk[:30].split(b"\0", 1)[0].decode("latin-1").strip()
        if not name:
            continue
        a = chunk[30:]
        word = lambda offset: struct.unpack_from("<H", a, offset)[0]  # noqa: E731
        data = {
            "name": name,
            "level": a[1],
            "twoHand": bool(a[0]),
            "skill": a[3],
            "damage": [a[6], a[7]],
            "blocking": a[8],
            "defense": a[9],
            "magicDefense": a[10],
            "attackSpeed": a[11],
            "walkSpeed": a[12],
            "durability": a[13],
            "magicDurability": a[14],
            "magicPower": a[15],
            "reqStrength": word(16),
            "reqAgility": word(18),
            "reqEnergy": word(20),
            "reqVitality": word(22),
            "reqLevel": a[24],
            "classes": list(a[31:36]),
            "resistances": list(a[36:43]),
        }
        # Só guarda o que tem valor, para o arquivo ficar pequeno.
        compact = {k: v for k, v in data.items() if (any(v) if isinstance(v, list) else v)}
        items[f"{number // 32}-{number % 32}"] = compact

    args.out.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(items)} itens -> {args.out} ({args.out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
