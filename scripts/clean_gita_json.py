#!/usr/bin/env python3
"""Clean markdown artifacts from gita_all_langs.json."""

import json
import re
from pathlib import Path

SRC = Path.home() / "git_projects/gita_scroll/static/gita_all_langs.json"


def clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove blockquote markers
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)
    # Remove bold markers **...**
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.DOTALL)
    # Remove italic markers *...*
    text = re.sub(r"\*([^*]+?)\*", r"\1", text)
    # Remove trailing backslashes (line continuation in markdown)
    text = re.sub(r"\\\s*$", "", text, flags=re.MULTILINE)
    # Normalize multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main():
    print("Loading...")
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)

    print(f"Cleaning {data['total']} verses...")
    for v in data["verses"]:
        v["devanagari"] = clean_text(v.get("devanagari", ""))
        for lang, content in v["langs"].items():
            content["transliteration"] = clean_text(content.get("transliteration", ""))
            content["word_for_word"] = clean_text(content.get("word_for_word", ""))
            content["translation"] = clean_text(content.get("translation", ""))
            content["purport"] = clean_text(content.get("purport", ""))

    with open(SRC, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = SRC.stat().st_size / 1024 / 1024
    print(f"Done: {size_mb:.1f} MB")

    # Show sample
    v = next((x for x in data["verses"] if x["ref"] == "bg/2/13"), None)
    if v:
        print("\nSample BG 2.13:")
        print("  Devanagari:", v["devanagari"][:60])
        print("  EN:", v["langs"]["en"]["translation"][:80])
        print("  ES:", v["langs"]["es"]["translation"][:80])


if __name__ == "__main__":
    main()
