#!/usr/bin/env python3 -I
"""Saca de los dos PNG de render.mjs todos los iconos de la PWA (static/icons/*, static/favicon.png)
y deja scripts/icon/icon-1024.png como fuente para `npx tauri icon`. Uso: python3 -I scripts/icon/make_icons.py"""
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
full = Image.open(os.path.join(HERE, "icon-1024-full.png")).convert("RGB")
rnd = Image.open(os.path.join(HERE, "icon-1024-round.png")).convert("RGBA")
out = os.path.join(ROOT, "static", "icons"); os.makedirs(out, exist_ok=True)
def save(img, path, size): img.resize((size, size), Image.LANCZOS).save(path, optimize=True)
save(rnd, os.path.join(out, "icon-192.png"), 192)               # "any"
save(rnd, os.path.join(out, "icon-512.png"), 512)               # "any"
save(full, os.path.join(out, "icon-maskable-512.png"), 512)     # "maskable": a sangre, el dibujo cabe en el círculo central del 80 %
save(full, os.path.join(out, "apple-touch-icon.png"), 180)      # iOS pone su propia máscara
save(rnd, os.path.join(ROOT, "static", "favicon.png"), 64)
full.save(os.path.join(HERE, "icon-1024.png"), optimize=True)
print("iconos escritos en", out)
