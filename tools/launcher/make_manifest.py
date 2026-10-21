"""Gera o manifest.json que o launcher usa para atualizar o cliente.

Uso:
    python tools/launcher/make_manifest.py "<pasta do cliente>" \
        --base-url https://mu-reborn.duckdns.org/client --version 1.0.1 --out manifest.json

Depois publique a pasta do cliente em --base-url (mesma estrutura de pastas) e o manifest.json
no endereço configurado em "manifestUrl" do launcher.json. O launcher baixa só os arquivos
que faltam ou estão diferentes (compara tamanho e SHA-256).
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

# Arquivos do jogador que não fazem parte do cliente distribuído.
SKIP_NAMES = {"MuError.log", "launcher.json", "MuRebornLauncher.exe", "manifest.json", "README.md", ".gitattributes"}
SKIP_DIRS = {"ScreenShots", ".git"}
SKIP_SUFFIXES = {".download", ".log"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("client", type=Path)
    parser.add_argument("--base-url", required=True, help="endereço https onde a pasta do cliente fica publicada")
    parser.add_argument("--version", required=True)
    parser.add_argument("--out", type=Path, default=Path("manifest.json"))
    args = parser.parse_args()

    if not args.base_url.startswith("https://"):
        parser.error("--base-url precisa ser https")

    files = []
    for path in sorted(args.client.rglob("*")):
        relative = path.relative_to(args.client)
        if not path.is_file() or path.name in SKIP_NAMES or path.suffix.lower() in SKIP_SUFFIXES:
            continue
        if relative.parts[0] in SKIP_DIRS:
            continue
        files.append({"path": relative.as_posix(), "size": path.stat().st_size, "sha256": sha256(path)})

    manifest = {"version": args.version, "baseUrl": args.base_url.rstrip("/"), "files": files}
    args.out.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    total = sum(f["size"] for f in files)
    print(f"{len(files)} arquivos, {total / 1024 / 1024:.1f} MB -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
