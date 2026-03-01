import io

import pytest
from app.services.pdf_preprocess import PDFPreprocessError, prepare_pdf_for_gemini, split_pdf_bytes
from pypdf import PdfWriter


def _make_pdf_bytes(page_count: int) -> bytes:
    """Create an in-memory PDF with blank pages."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=595, height=842)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_prepare_pdf_original_mode_when_under_limit():
    pdf_bytes = _make_pdf_bytes(page_count=3)

    prepared = prepare_pdf_for_gemini(
        pdf_bytes,
        max_bytes=len(pdf_bytes) + 100,
        split_target_bytes=len(pdf_bytes) + 100,
        enable_preprocess=True,
    )

    assert prepared.mode == "original"
    assert prepared.parts_count == 1
    assert prepared.parts[0].start_page == 1
    assert prepared.parts[0].end_page == 3


def test_prepare_pdf_raises_when_preprocess_disabled():
    pdf_bytes = _make_pdf_bytes(page_count=3)

    with pytest.raises(PDFPreprocessError, match="exceeds"):
        prepare_pdf_for_gemini(
            pdf_bytes,
            max_bytes=len(pdf_bytes) - 1,
            split_target_bytes=len(pdf_bytes) - 2,
            enable_preprocess=False,
        )


def test_split_pdf_bytes_creates_contiguous_parts():
    pdf_bytes = _make_pdf_bytes(page_count=12)

    parts = split_pdf_bytes(
        pdf_bytes,
        target_part_bytes=max(1000, len(pdf_bytes) // 5),
        max_part_bytes=max(1500, len(pdf_bytes) // 4),
    )

    assert len(parts) >= 2
    assert parts[0].start_page == 1
    assert parts[-1].end_page == 12
    assert all(part.size_bytes <= max(1500, len(pdf_bytes) // 4) for part in parts)

    # Verify no page gaps between parts.
    expected_start = 1
    for part in parts:
        assert part.start_page == expected_start
        expected_start = part.end_page + 1


def test_prepare_pdf_falls_back_to_split_without_ghostscript(monkeypatch):
    pdf_bytes = _make_pdf_bytes(page_count=20)

    monkeypatch.setattr("app.services.pdf_preprocess.shutil.which", lambda _cmd: None)

    prepared = prepare_pdf_for_gemini(
        pdf_bytes,
        max_bytes=max(2000, len(pdf_bytes) // 6),
        split_target_bytes=max(1500, len(pdf_bytes) // 8),
        enable_preprocess=True,
        compression_profile="balanced",
    )

    assert prepared.mode == "split"
    assert prepared.parts_count >= 2
