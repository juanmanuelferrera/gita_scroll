#!/usr/bin/env python3 -I
"""Nombres de capítulo del Bhagavad-gītā en cada idioma → src/lib/chapter-names.json.
Salen de los nombres establecidos de vedabase.cc (astro_vedabase/src/lib/chapter-names-<lang>.json, claves bg/1 … bg/18);
el inglés lo pone la propia app (nombres cortos). Uso: python3 -I scripts/chapter_names.py"""
import json, os, re
SRC = os.path.expanduser("~/git_projects/astro_vedabase/src/lib")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "lib", "chapter-names.json")
res = {}
for lang in ["es", "pt", "hi", "bn", "zh", "bul", "fr", "ru", "ar"]:
    d = json.load(open(os.path.join(SRC, f"chapter-names-{lang}.json"), encoding="utf-8"))
    names = []
    for n in range(1, 19):
        t = d.get(f"bg/{n}")
        assert t, (lang, n)
        names.append(re.sub(r"\s+", " ", t.replace("*", "")).strip())     # fuera el markdown (*Gītā*)
    res[lang] = names
json.dump(res, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("escrito", OUT, {k: len(v) for k, v in res.items()})
