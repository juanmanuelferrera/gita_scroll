#!/usr/bin/env python3
"""Parse Bhagavad Gita markdown files from vedabase-original into gita.json."""

import json
import re
import os
from pathlib import Path

GITA_DIR = Path.home() / "git_projects/vedabase-original/bhagavad-gita-as-it-is"
OUT_FILE = Path.home() / "git_projects/gita_scroll/static/gita.json"

CHAPTER_NAMES = {
    1: "Observing the Armies on the Battlefield of Kurukṣetra",
    2: "Contents of the Gītā Summarized",
    3: "Karma-yoga",
    4: "Transcendental Knowledge",
    5: "Karma-yoga – Action in Kṛṣṇa Consciousness",
    6: "Sāṅkhya-yoga",
    7: "Knowledge of the Absolute",
    8: "Attaining the Supreme",
    9: "The Most Confidential Knowledge",
    10: "The Opulence of the Absolute",
    11: "The Universal Form",
    12: "Devotional Service",
    13: "Nature, the Enjoyer, and Consciousness",
    14: "The Three Modes of Material Nature",
    15: "The Yoga of the Supreme Person",
    16: "The Divine and Demoniac Natures",
    17: "The Divisions of Faith",
    18: "Conclusion – The Perfection of Renunciation",
}


def parse_verse_file(path: Path) -> list[dict]:
    """Parse one verse file; returns list (usually 1, sometimes multiple for combined verses)."""
    text = path.read_text(encoding="utf-8")

    # Extract verse ref from heading e.g. "### Bg 2.13" or "### Bg 1.16-18"
    ref_match = re.match(r"###\s+Bg\s+([\d.]+(?:-\d+)?)", text)
    if not ref_match:
        return []
    ref = ref_match.group(1)  # e.g. "2.13" or "1.16-18"

    # Split chapter and verse
    parts = ref.split(".")
    chapter = int(parts[0])
    verse_raw = parts[1] if len(parts) > 1 else "0"

    # Handle combined verses like "1.16-18"
    if "-" in verse_raw:
        verse_parts = verse_raw.split("-")
        verse_start = int(verse_parts[0])
        verse_end = int(verse_parts[1])
        verse_label = verse_raw
    else:
        verse_start = int(verse_raw)
        verse_end = verse_start
        verse_label = verse_raw

    # Extract blockquotes: first = devanagari, second = transliteration
    blockquotes = re.findall(r"^>(.*?)(?=^[^>]|\Z)", text, re.MULTILINE | re.DOTALL)
    devanagari = ""
    transliteration = ""
    if len(blockquotes) >= 1:
        devanagari = clean_blockquote(blockquotes[0])
    if len(blockquotes) >= 2:
        transliteration = clean_blockquote(blockquotes[1])

    # Extract word-for-word (italic paragraph starting with *)
    wfw_match = re.search(r"\n(\*[^\n]+(?:\n\*[^\n]+)*)", text)
    word_for_word = wfw_match.group(1).strip() if wfw_match else ""

    # Extract translation (bold paragraph)
    trans_match = re.search(r"\*\*(.+?)\*\*", text, re.DOTALL)
    translation = trans_match.group(1).strip() if trans_match else ""

    # Extract purport: everything after the bold translation
    purport = ""
    if trans_match:
        after = text[trans_match.end():].strip()
        purport = after if after else ""

    return [{
        "ref": ref,
        "chapter": chapter,
        "verse": verse_label,
        "verse_start": verse_start,
        "verse_end": verse_end,
        "devanagari": devanagari,
        "transliteration": transliteration,
        "word_for_word": word_for_word,
        "translation": translation,
        "purport": purport,
    }]


def clean_blockquote(raw: str) -> str:
    """Remove leading '> ' from each line and normalize."""
    lines = raw.split("\n")
    cleaned = []
    for line in lines:
        line = line.strip()
        if line.startswith("> "):
            line = line[2:]
        elif line.startswith(">"):
            line = line[1:]
        line = line.rstrip("\\").strip()
        if line:
            cleaned.append(line)
    return "\n".join(cleaned)


def main():
    verses = []
    for chapter in range(1, 19):
        chapter_dir = GITA_DIR / f"chapter-{chapter:02d}"
        if not chapter_dir.exists():
            print(f"Missing: {chapter_dir}")
            continue
        files = sorted(chapter_dir.glob("bg-*.md"))
        for f in files:
            if "colophon" in f.name:
                continue
            parsed = parse_verse_file(f)
            verses.extend(parsed)

    # Sort by chapter, then verse_start
    verses.sort(key=lambda v: (v["chapter"], v["verse_start"]))

    # Add sequential index
    for i, v in enumerate(verses):
        v["index"] = i

    output = {
        "book": "Bhagavad-gītā As It Is",
        "author": "A.C. Bhaktivedanta Swami Prabhupāda",
        "total": len(verses),
        "chapters": [
            {"number": n, "name": name, "verses": sum(1 for v in verses if v["chapter"] == n)}
            for n, name in CHAPTER_NAMES.items()
        ],
        "verses": verses,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done: {len(verses)} verses → {OUT_FILE}")


if __name__ == "__main__":
    main()
