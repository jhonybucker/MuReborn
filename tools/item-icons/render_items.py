"""Gera ícones PNG/WebP dos itens do MU 99b a partir dos modelos 3D do cliente (.bmd).

Uso (Python 3.10+ com numpy e pillow):
    python render_items.py "<cliente>/Data/Item" Staff11.bmd Wing02.bmd --out ./saida
    python render_items.py "<cliente>/Data/Item" Staff11.bmd=5-10 --out ./saida   # salva como 5-10.webp

Formato .bmd (versão 10 sem criptografia; versão 12 com a criptografia simples dos clientes 1.0x):
cabeçalho, malhas (vértices presos a ossos, normais, coordenadas de textura, triângulos/quads),
animações e ossos. O ícone usa a primeira pose da primeira animação.
"""

from __future__ import annotations

import argparse
import io
import math
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

# Chave da criptografia dos .bmd versão 12 (mesma dos arquivos de mapa dos clientes 1.0x).
XOR_KEY = bytes([0xD1, 0x73, 0x52, 0xF6, 0xD2, 0x9A, 0xCB, 0x27, 0x3E, 0xAF, 0x59, 0x31, 0x37, 0xB3, 0xE7, 0xA2])


def decrypt_v12(data: bytes) -> bytes:
    out = bytearray(len(data))
    key = 0x5E
    for i, b in enumerate(data):
        out[i] = ((b ^ XOR_KEY[i % 16]) - key) & 0xFF
        key = (b + 0x3D) & 0xFF
    return bytes(out)


@dataclass
class Mesh:
    vertices: np.ndarray  # (n, 3) já na pose
    normals: np.ndarray  # (n, 3)
    uvs: np.ndarray  # (n, 2)
    triangles: list[tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]]
    texture: str


class Reader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def read(self, fmt: str):
        size = struct.calcsize(fmt)
        values = struct.unpack_from(fmt, self.data, self.pos)
        self.pos += size
        return values

    def string(self, size: int) -> str:
        raw = self.data[self.pos : self.pos + size]
        self.pos += size
        return raw.split(b"\0", 1)[0].decode("latin-1")


def angle_matrix(angles) -> np.ndarray:
    """Rotação a partir dos ângulos (radianos) no padrão do MU/Half-Life: x=roll, y=pitch, z=yaw."""
    sr, cr = math.sin(angles[0]), math.cos(angles[0])
    sp, cp = math.sin(angles[1]), math.cos(angles[1])
    sy, cy = math.sin(angles[2]), math.cos(angles[2])
    return np.array(
        [
            [cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy],
            [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy],
            [-sp, sr * cp, cr * cp],
        ]
    )


def load_bmd(path: Path) -> list[Mesh]:
    raw = path.read_bytes()
    if raw[:3] != b"BMD":
        raise ValueError(f"{path.name}: não é um .bmd")
    version = raw[3]
    if version == 12:
        (size,) = struct.unpack_from("<I", raw, 4)
        body = decrypt_v12(raw[8 : 8 + size])
    elif version == 10:
        body = raw[4:]
    else:
        raise ValueError(f"{path.name}: versão {version} não suportada")

    r = Reader(body)
    r.string(32)  # nome interno
    num_meshes, num_bones, num_actions = r.read("<HHH")

    raw_meshes = []
    for _ in range(num_meshes):
        nv, nn, nt, ntri, _tex = r.read("<HHHHh")
        verts = [r.read("<hxx3f") for _ in range(nv)]
        norms = [r.read("<hxx3fhxx") for _ in range(nn)]
        uvs = [r.read("<2f") for _ in range(nt)]
        tris = []
        for _ in range(ntri):
            start = r.pos
            polygon = body[start]
            vi = struct.unpack_from("<4h", body, start + 2)
            ni = struct.unpack_from("<4h", body, start + 10)
            ti = struct.unpack_from("<4h", body, start + 18)
            r.pos = start + 64
            tris.append((polygon, vi, ni, ti))
        texture = r.string(32)
        raw_meshes.append((verts, norms, uvs, tris, texture))

    keys_per_action = []
    for _ in range(num_actions):
        (num_keys,) = r.read("<H")
        (lock,) = r.read("<B")
        if lock:
            r.pos += 12 * num_keys
        keys_per_action.append(num_keys)

    # Ossos: posição/rotação da primeira pose da primeira animação.
    bone_world: list[np.ndarray] = []
    for _ in range(num_bones):
        (dummy,) = r.read("<B")
        world = np.eye(4)
        if not dummy:
            r.string(32)
            (parent,) = r.read("<h")
            first_pos = first_rot = None
            for keys in keys_per_action:
                positions = [r.read("<3f") for _ in range(keys)]
                rotations = [r.read("<3f") for _ in range(keys)]
                if first_pos is None and keys:
                    first_pos, first_rot = positions[0], rotations[0]
            local = np.eye(4)
            if first_pos is not None:
                local[:3, :3] = angle_matrix(first_rot)
                local[:3, 3] = first_pos
            world = bone_world[parent] @ local if 0 <= parent < len(bone_world) else local
        bone_world.append(world)

    meshes = []
    for verts, norms, uvs, tris, texture in raw_meshes:
        def bone(index: int) -> np.ndarray:
            return bone_world[index] if 0 <= index < len(bone_world) else np.eye(4)

        v = np.array([(bone(n) @ np.array([*p, 1.0]))[:3] for n, *p in verts]) if verts else np.zeros((0, 3))
        nrm = np.array([bone(n)[:3, :3] @ np.array(p) for n, *p, _bind in norms]) if norms else np.zeros((0, 3))
        uv = np.array(uvs) if uvs else np.zeros((0, 2))
        faces = []
        for polygon, vi, ni, ti in tris:
            corners = [(0, 1, 2)] if polygon == 3 else [(0, 1, 2), (0, 2, 3)]
            for a, b, c in corners:
                faces.append(((vi[a], vi[b], vi[c]), (ni[a], ni[b], ni[c]), (ti[a], ti[b], ti[c])))
        meshes.append(Mesh(v, nrm, uv, faces, texture))
    return meshes


def load_texture(folder: Path, name: str) -> np.ndarray | None:
    """Acha a textura (.jpg → .OZJ, .tga → .OZT) sem diferenciar maiúsculas e devolve RGBA float."""
    stem = Path(name.replace("\\", "/")).stem.lower()
    ext = Path(name).suffix.lower()
    wanted = {".jpg": [".ozj"], ".tga": [".ozt"]}.get(ext, [".ozj", ".ozt"])
    for file in folder.iterdir():
        if file.stem.lower() == stem and file.suffix.lower() in wanted:
            data = file.read_bytes()
            payload = data[24:] if file.suffix.lower() == ".ozj" else data[4:]
            try:
                image = Image.open(io.BytesIO(payload)).convert("RGBA")
            except Exception:
                return None
            return np.asarray(image, dtype=np.float32) / 255.0
    return None


def sample_bilinear(texture: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Lê a textura com interpolação bilinear (texturas pequenas ficam suaves em vez de pixeladas)."""
    th, tw = texture.shape[:2]
    x = np.mod(u, 1.0) * tw - 0.5
    y = np.mod(v, 1.0) * th - 0.5
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    x0, x1 = np.mod(x0, tw), np.mod(x0 + 1, tw)
    y0, y1 = np.mod(y0, th), np.mod(y0 + 1, th)
    top = texture[y0, x0] * (1 - fx) + texture[y0, x1] * fx
    bottom = texture[y1, x0] * (1 - fx) + texture[y1, x1] * fx
    return top * (1 - fy) + bottom * fy


def orientation(points: np.ndarray, horizontal: bool = False, upright: bool = False) -> np.ndarray:
    """Câmera olhando a face mais larga, com leve giro para dar volume.

    Armas e o resto: eixo mais comprido na vertical, com a origem do modelo (o ponto onde o
    personagem segura) embaixo. Asas (horizontal=True): eixo mais comprido na horizontal, abertas.
    """
    center = points.mean(axis=0)
    centered = points - center
    if upright:
        # Peças de corpo (Data/Player) já vêm em pé no jogo: Z para cima, vistas de frente.
        basis = np.array([[-1.0, 0, 0], [0, 0, 1.0], [0, 1.0, 0]])
        tilt_y = math.radians(25)
        ry = np.array([[math.cos(tilt_y), 0, math.sin(tilt_y)], [0, 1, 0], [-math.sin(tilt_y), 0, math.cos(tilt_y)]])
        return ry @ basis
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    longest, middle, depth = vt[0], vt[1], vt[2]
    side, up = (longest, middle) if horizontal else (middle, longest)
    basis = np.stack([side, up, depth])  # x da tela, y da tela, profundidade
    origin = (-center) @ basis.T
    if origin[1] > 0:  # pegada para baixo
        basis[1] = -basis[1]
    if np.linalg.det(basis) < 0:
        basis[0] = -basis[0]
    tilt_y, tilt_x = math.radians(20), math.radians(-12)
    ry = np.array([[math.cos(tilt_y), 0, math.sin(tilt_y)], [0, 1, 0], [-math.sin(tilt_y), 0, math.cos(tilt_y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(tilt_x), -math.sin(tilt_x)], [0, math.sin(tilt_x), math.cos(tilt_x)]])
    return rx @ ry @ basis


def render(
    meshes: list[Mesh], folder: Path, size: int, horizontal: bool = False, upright: bool = False, supersample: int = 3
) -> Image.Image:
    points = np.concatenate([m.vertices for m in meshes if len(m.vertices)])
    rotation = orientation(points, horizontal, upright)
    center = points.mean(axis=0)
    view = [(m, (m.vertices - center) @ rotation.T, m.normals @ rotation.T if len(m.normals) else m.normals) for m in meshes]
    all_view = np.concatenate([v for _, v, _ in view])
    lo, hi = all_view[:, :2].min(axis=0), all_view[:, :2].max(axis=0)
    scale = (size * supersample * 0.88) / max(hi - lo)
    full = size * supersample
    offset = (full - (hi - lo) * scale) / 2

    color = np.zeros((full, full, 4), dtype=np.float32)
    depth = np.full((full, full), np.inf, dtype=np.float32)
    light = np.array([-0.4, 0.6, -0.7])
    light /= np.linalg.norm(light)

    for mesh, verts, normals in view:
        texture = load_texture(folder, mesh.texture)
        screen = np.empty((len(verts), 3))
        screen[:, 0] = (verts[:, 0] - lo[0]) * scale + offset[0]
        screen[:, 1] = full - ((verts[:, 1] - lo[1]) * scale + offset[1])
        screen[:, 2] = verts[:, 2]
        for vi, ni, ti in mesh.triangles:
            try:
                tri = screen[list(vi)]
            except IndexError:
                continue
            x0, y0 = np.floor(tri[:, :2].min(axis=0)).astype(int)
            x1, y1 = np.ceil(tri[:, :2].max(axis=0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, full - 1), min(y1, full - 1)
            if x0 > x1 or y0 > y1:
                continue
            (ax, ay, az), (bx, by, bz), (cx, cy, cz) = tri
            area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
            if abs(area) < 1e-9:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            w0 = ((bx - xs) * (cy - ys) - (cx - xs) * (by - ys)) / area
            w1 = ((cx - xs) * (ay - ys) - (ax - xs) * (cy - ys)) / area
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * az + w1 * bz + w2 * cz
            region_depth = depth[y0 : y1 + 1, x0 : x1 + 1]
            visible = inside & (z < region_depth)
            if not visible.any():
                continue

            if texture is not None and len(mesh.uvs) and max(ti) < len(mesh.uvs):
                uv = mesh.uvs[list(ti)]
                u = w0 * uv[0, 0] + w1 * uv[1, 0] + w2 * uv[2, 0]
                v = w0 * uv[0, 1] + w1 * uv[1, 1] + w2 * uv[2, 1]
                rgba = sample_bilinear(texture, u, v)
            else:
                rgba = np.broadcast_to(np.array([0.7, 0.7, 0.72, 1.0], dtype=np.float32), (*w0.shape, 4))

            if len(normals) and max(ni) < len(normals):
                n = normals[list(ni)]
                nx = w0 * n[0, 0] + w1 * n[1, 0] + w2 * n[2, 0]
                ny = w0 * n[0, 1] + w1 * n[1, 1] + w2 * n[2, 1]
                nz = w0 * n[0, 2] + w1 * n[1, 2] + w2 * n[2, 2]
                length = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-9
                shade = np.abs(nx * light[0] + ny * light[1] + nz * light[2]) / length
            else:
                shade = np.full(w0.shape, 0.8)
            brightness = 0.45 + 0.75 * shade

            # Texturas com alfa (TGA) recortam o desenho; pixels quase transparentes não entram.
            visible &= rgba[..., 3] > 0.35
            region_color = color[y0 : y1 + 1, x0 : x1 + 1]
            region_color[visible, :3] = np.clip(rgba[..., :3][visible] * brightness[visible, None], 0, 1)
            region_color[visible, 3] = 1.0
            region_depth[visible] = z[visible]

    image = Image.fromarray((color * 255).astype(np.uint8), "RGBA")
    return image.resize((size, size), Image.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="pasta Data/Item (ou Data/Player) do cliente")
    parser.add_argument("models", nargs="+", help="Arquivo.bmd ou Arquivo.bmd=grupo-indice")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--size", type=int, default=256)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    failures = 0
    for spec in args.models:
        model, _, target = spec.partition("=")
        path = args.folder / model
        try:
            image = render(
                load_bmd(path),
                args.folder,
                args.size,
                horizontal=model.lower().startswith("wing"),
                upright=args.folder.name.lower() == "player",
            )
            name = target or Path(model).stem
            image.save(args.out / f"{name}.webp", "WEBP", quality=90)
            print(f"ok   {model} -> {name}.webp")
        except Exception as error:  # um modelo ruim não para o lote
            failures += 1
            print(f"erro {model}: {error}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
