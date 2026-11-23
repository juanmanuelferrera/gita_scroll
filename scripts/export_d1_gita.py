#!/usr/bin/env python3
"""Export all BG verses from vedabase D1 database into gita_all_langs.json."""

import json
import subprocess
import sys
from pathlib import Path

WRANGLER_DIR = Path.home() / "git_projects/astro_vedabase"
OUT_FILE = Path.home() / "git_projects/gita_scroll/static/gita_all_langs.json"

LANGS = ["en", "es", "pt", "hi", "bn", "zh", "bul", "fr", "ru", "ar"]

LANG_NAMES = {
    "en": "English",
    "es": "Español",
    "pt": "Português",
    "hi": "हिन्दी",
    "bn": "বাংলা",
    "zh": "中文",
    "bul": "Български",
    "fr": "Français",
    "ru": "Русский",
    "ar": "العربية",
}

def query_d1(sql: str) -> list[dict]:
    cmd = [
        "npx", "wrangler", "d1", "execute", "vedabase-search-db",
        "--remote", "--json",
        "--command", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=WRANGLER_DIR)
    if result.returncode != 0:
        print(f"Error: {result.stderr[:500]}", file=sys.stderr)
        return []
    try:
        data = json.loads(result.stdout)
        return data[0]["results"] if data else []
    except Exception as e:
        print(f"Parse error: {e}\nOutput: {result.stdout[:200]}", file=sys.stderr)
        return []


def parse_ref(ref: str) -> tuple[int, str]:
    """'bg/2/13' → (2, '13'); 'bg/1/16-18' → (1, '16-18')"""
    parts = ref.split("/")
    if len(parts) >= 3:
        return int(parts[1]), parts[2]
    return 0, ref


def main():
    print("Querying D1 for all BG verses...")

    # Fetch all languages
    all_verses: dict[str, dict] = {}  # ref → {ref, chapter, verse, devanagari, langs:{lang: {...}}}

    for lang in LANGS:
        print(f"  [{lang}] fetching...", end="", flush=True)
        rows = query_d1(
            f"SELECT ref, verse_text, synonyms, translation, purport, devanagari, nav_seq "
            f"FROM verses WHERE book='bg' AND lang='{lang}' ORDER BY nav_seq"
        )
        print(f" {len(rows)} verses")

        for row in rows:
            ref = row["ref"]  # e.g. "bg/2/13"
            chapter, verse = parse_ref(ref)

            if ref not in all_verses:
                all_verses[ref] = {
                    "ref": ref,
                    "chapter": chapter,
                    "verse": verse,
                    "nav_seq": row.get("nav_seq") or 0,
                    "devanagari": row.get("devanagari") or "",
                    "langs": {},
                }

            # Update devanagari from any lang (should be same)
            if row.get("devanagari"):
                all_verses[ref]["devanagari"] = row["devanagari"]

            all_verses[ref]["langs"][lang] = {
                "transliteration": row.get("verse_text") or "",
                "word_for_word": row.get("synonyms") or "",
                "translation": row.get("translation") or "",
                "purport": row.get("purport") or "",
            }

    # Sort by nav_seq
    verses = sorted(all_verses.values(), key=lambda v: (v["chapter"], v["nav_seq"]))

    # Add sequential index
    for i, v in enumerate(verses):
        v["index"] = i

    output = {
        "book": "Bhagavad-gītā As It Is",
        "author": "A.C. Bhaktivedanta Swami Prabhupāda",
        "total": len(verses),
        "languages": [{"code": c, "name": n} for c, n in LANG_NAMES.items()],
        "verses": verses,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT_FILE.stat().st_size / 1024 / 1024
    print(f"\nDone: {len(verses)} verses, {size_mb:.1f} MB → {OUT_FILE}")


if __name__ == "__main__":
    main()
