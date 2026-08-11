"""Verify generated TEST FIXTURE files without reading any user resume data."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path

import pdfplumber
from docx import Document
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
QA_DIR = ROOT / "tmp" / "qa" / "resume-import"


def normalized(text: str) -> str:
    return re.sub(r"\s+", "", text)


def similarity(actual: str, expected: str) -> float:
    return round(SequenceMatcher(None, normalized(expected), normalized(actual)).ratio(), 4)


def main() -> None:
    golden = (QA_DIR / "golden-text.txt").read_text(encoding="utf-8")
    fixture = json.loads((ROOT / "tests" / "fixtures" / "resume-import-fixture.json").read_text(encoding="utf-8"))
    txt = (QA_DIR / "resume-fixture.txt").read_text(encoding="utf-8")
    docx = "\n".join(paragraph.text for paragraph in Document(QA_DIR / "resume-fixture.docx").paragraphs)
    with pdfplumber.open(QA_DIR / "resume-fixture.pdf") as document:
        pdf_pages = [page.extract_text() or "" for page in document.pages]
        pdf_sizes = [[round(page.width, 2), round(page.height, 2)] for page in document.pages]
    image_results = {}
    for suffix in ("png", "jpg"):
        path = QA_DIR / f"resume-fixture.{suffix}"
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image_results[suffix] = {
                "valid": True,
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
            }
    result = {
        "fixture": "TEST FIXTURE only; synthetic and unrelated to any real person",
        "text_extraction": {
            "txt": {"nonempty": bool(txt.strip()), "normalized_similarity": similarity(txt, golden)},
            "docx": {"nonempty": bool(docx.strip()), "normalized_similarity": similarity(docx, golden)},
            "pdf": {
                "nonempty": bool("".join(pdf_pages).strip()),
                "normalized_similarity": similarity("\n".join(pdf_pages), golden),
                "pages": len(pdf_pages),
                "page_sizes_points": pdf_sizes,
            },
        },
        "images": image_results,
    }
    expected_fields = [
        fixture["name"], fixture["email"], fixture["phone"], fixture["city"],
        fixture["summary"], "\n\n".join(fixture["education"]),
        "\n\n".join(fixture["experience"]), "\n\n".join(fixture["project"]),
        "\n\n".join(fixture["campus"]), fixture["skills"], fixture["certificate"],
        fixture["evaluation"], fixture["portfolio"],
    ]
    timings_path = ROOT / "tmp" / "qa" / "ocr-timings.json"
    timings = json.loads(timings_path.read_text(encoding="utf-8")) if timings_path.exists() else {}
    ocr_results = {}
    for suffix in ("png", "jpg"):
        raw_path = ROOT / "tmp" / "qa" / f"ocr-{suffix}-final-raw.txt"
        fields_path = ROOT / "tmp" / "qa" / f"ocr-{suffix}-final-fields.json"
        if not raw_path.exists() or not fields_path.exists():
            continue
        raw = raw_path.read_text(encoding="utf-8")
        fields = json.loads(fields_path.read_text(encoding="utf-8"))
        field_scores = [similarity(actual, expected) for actual, expected in zip(fields, expected_fields)]
        ocr_results[suffix] = {
            "completed": True,
            "elapsed_ms": timings.get(f"{suffix}_ms"),
            "raw_normalized_similarity": similarity(raw, golden),
            "exact_fields": sum(actual == expected for actual, expected in zip(fields, expected_fields)),
            "fields_total": len(expected_fields),
            "mapped_fields_at_least_0_80": sum(score >= 0.8 for score in field_scores),
            "field_similarities": field_scores,
        }
    result["ocr_browser_results"] = ocr_results
    output = ROOT / "tmp" / "qa" / "qa-metrics.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
