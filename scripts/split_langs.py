#!/usr/bin/env python3 -I
"""Parte static/gita_all_langs.json en static/data/core.json (versos sin textos) + static/data/<lang>.json ({index: textos}).
Uso: python3 -I scripts/split_langs.py"""
import json, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(R, "static", "gita_all_langs.json"), encoding="utf-8"))
O = os.path.join(R, "static", "data"); os.makedirs(O, exist_ok=True)
V = d["verses"]
core = {k: v for k, v in d.items() if k != "verses"}
core["verses"] = [{k: x for k, x in v.items() if k != "langs"} for v in V]
json.dump(core, open(os.path.join(O, "core.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
for lg in d["languages"]:
    c = lg["code"]
    pack = {str(v["index"]): dict(v["langs"][c]) for v in V if c in v["langs"]}
    # restos de la exportación: la transliteración árabe empieza en 626 versos con una línea que es solo «.» (se veía como un punto suelto)
    for rec in pack.values():
        t = rec.get("transliteration")
        if t: rec["transliteration"] = re.sub(r"\A[ \t]*[.·،][ \t]*\n", "", t)
    json.dump(pack, open(os.path.join(O, c + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(c, len(pack), "versos", round(os.path.getsize(os.path.join(O, c + ".json")) / 1e6, 2), "MB")
