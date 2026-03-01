"""
PDF preprocessing utilities for Gemini upload constraints.

Handles three modes:
1. original: PDF already fits under max size
2. compressed: PDF reduced under max size via Ghostscript
3. split: PDF split into multiple parts under max size
"""

from __future__ import annotations

import io
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from typing import Literal

from pypdf import PdfReader, PdfWriter

CompressionMode = Literal["original", "compressed", "split"]


@dataclass(slots=True)
class CompressionAttempt:
    """Metadata for one compression ladder attempt."""

    color_dpi: int
    gray_dpi: int
    jpeg_quality: int
    output_size_bytes: int | None
    duration_seconds: float
    error: str | None = None


@dataclass(slots=True)
class PDFPart:
    """A single PDF chunk prepared for Gemini extraction."""

    bytes_data: bytes
    start_page: int
    end_page: int
    size_bytes: int

    @property
    def page_count(self) -> int:
        return self.end_page - self.start_page + 1


@dataclass(slots=True)
class PreparedPDF:
    """Result of preprocessing a PDF for Gemini extraction."""

    mode: CompressionMode
    original_size_bytes: int
    parts: list[PDFPart]
    compressed_size_bytes: int | None = None
    compression_attempts: list[CompressionAttempt] = field(default_factory=list)

    @property
    def parts_count(self) -> int:
        return len(self.parts)

    @property
    def total_output_bytes(self) -> int:
        return sum(part.size_bytes for part in self.parts)


class PDFPreprocessError(Exception):
    """Raised when preprocessing cannot produce Gemini-compatible PDFs."""

    def __init__(self, user_message: str, internal_message: str | None = None) -> None:
        super().__init__(internal_message or user_message)
        self.user_message = user_message
        self.internal_message = internal_message or user_message


def prepare_pdf_for_gemini(
    pdf_bytes: bytes,
    *,
    max_bytes: int,
    split_target_bytes: int,
    enable_preprocess: bool,
    compression_profile: str = "balanced",
) -> PreparedPDF:
    """Prepare a PDF for Gemini upload with compress-and-split fallback."""
    original_size_bytes = len(pdf_bytes)
    page_count = _count_pages(pdf_bytes)

    if original_size_bytes <= max_bytes:
        return PreparedPDF(
            mode="original",
            original_size_bytes=original_size_bytes,
            parts=[
                PDFPart(
                    bytes_data=pdf_bytes,
                    start_page=1,
                    end_page=page_count,
                    size_bytes=original_size_bytes,
                )
            ],
        )

    if not enable_preprocess:
        raise PDFPreprocessError(
            user_message=(
                f"PDF exceeds {max_bytes // (1024 * 1024)}MB limit. "
                "Please upload a smaller file."
            )
        )

    # Try compression first when Ghostscript is available.
    attempts: list[CompressionAttempt] = []
    compressed_bytes: bytes | None = None
    if shutil.which("gs"):
        compressed_bytes, attempts = _compress_with_ladder(
            pdf_bytes=pdf_bytes,
            max_bytes=max_bytes,
            profile=compression_profile,
        )

    # Use the smallest available bytes as split input.
    candidate_bytes = pdf_bytes
    compressed_size_bytes: int | None = None
    if compressed_bytes and len(compressed_bytes) < len(pdf_bytes):
        candidate_bytes = compressed_bytes
        compressed_size_bytes = len(compressed_bytes)

    if len(candidate_bytes) <= max_bytes:
        candidate_page_count = _count_pages(candidate_bytes)
        return PreparedPDF(
            mode="compressed",
            original_size_bytes=original_size_bytes,
            compressed_size_bytes=compressed_size_bytes,
            parts=[
                PDFPart(
                    bytes_data=candidate_bytes,
                    start_page=1,
                    end_page=candidate_page_count,
                    size_bytes=len(candidate_bytes),
                )
            ],
            compression_attempts=attempts,
        )

    parts = split_pdf_bytes(
        candidate_bytes,
        target_part_bytes=split_target_bytes,
        max_part_bytes=max_bytes,
    )

    return PreparedPDF(
        mode="split",
        original_size_bytes=original_size_bytes,
        compressed_size_bytes=compressed_size_bytes,
        parts=parts,
        compression_attempts=attempts,
    )


def split_pdf_bytes(
    pdf_bytes: bytes,
    *,
    target_part_bytes: int,
    max_part_bytes: int,
) -> list[PDFPart]:
    """Split PDF bytes into chunks that are each <= max_part_bytes."""
    if target_part_bytes <= 0 or max_part_bytes <= 0:
        raise PDFPreprocessError("Invalid preprocessing size limits")
    if target_part_bytes > max_part_bytes:
        raise PDFPreprocessError("Split target bytes must be <= max bytes")

    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    if total_pages == 0:
        raise PDFPreprocessError("PDF has no pages")

    parts: list[PDFPart] = []
    current_page_indices: list[int] = []
    current_part_bytes: bytes | None = None
    part_start_page = 1

    for page_index in range(total_pages):
        candidate_indices = current_page_indices + [page_index]
        candidate_bytes = _build_pdf_bytes(reader, candidate_indices)

        # Keep growing current part while under target, or when this is the first page.
        if len(candidate_bytes) <= target_part_bytes or not current_page_indices:
            current_page_indices = candidate_indices
            current_part_bytes = candidate_bytes
            continue

        if current_part_bytes is None:
            raise PDFPreprocessError("Failed to build PDF chunk")

        # Finalize previous part.
        finalized_end_page = part_start_page + len(current_page_indices) - 1
        parts.append(
            PDFPart(
                bytes_data=current_part_bytes,
                start_page=part_start_page,
                end_page=finalized_end_page,
                size_bytes=len(current_part_bytes),
            )
        )

        # Start a new part with current page.
        single_page_bytes = _build_pdf_bytes(reader, [page_index])
        if len(single_page_bytes) > max_part_bytes:
            raise PDFPreprocessError(
                user_message=(
                    "Unable to process this PDF automatically. "
                    "At least one page remains above the Gemini file size limit "
                    "even after preprocessing. If you are self-hosting NANA, "
                    "install Ghostscript to enable stronger compression."
                ),
                internal_message=(
                    f"Single page {page_index + 1} exceeds max part size: "
                    f"{len(single_page_bytes)} bytes"
                ),
            )

        current_page_indices = [page_index]
        current_part_bytes = single_page_bytes
        part_start_page = page_index + 1

    if current_part_bytes is None:
        raise PDFPreprocessError("Failed to split PDF into chunks")

    final_end_page = part_start_page + len(current_page_indices) - 1
    parts.append(
        PDFPart(
            bytes_data=current_part_bytes,
            start_page=part_start_page,
            end_page=final_end_page,
            size_bytes=len(current_part_bytes),
        )
    )

    oversized_parts = [part for part in parts if part.size_bytes > max_part_bytes]
    if oversized_parts:
        raise PDFPreprocessError(
            "Unable to split PDF into Gemini-compatible chunks. "
            "Please compress the file and try again."
        )

    return parts


def _count_pages(pdf_bytes: bytes) -> int:
    """Count pages in PDF bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    count = len(reader.pages)
    if count == 0:
        raise PDFPreprocessError("PDF has no pages")
    return count


def _build_pdf_bytes(reader: PdfReader, page_indices: list[int]) -> bytes:
    """Build a PDF byte payload containing the specified page indices."""
    writer = PdfWriter()
    for idx in page_indices:
        writer.add_page(reader.pages[idx])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def _compress_with_ladder(
    *,
    pdf_bytes: bytes,
    max_bytes: int,
    profile: str,
) -> tuple[bytes | None, list[CompressionAttempt]]:
    """Try compression passes until size <= max_bytes or ladder exhausted."""
    attempts: list[CompressionAttempt] = []
    best_bytes: bytes | None = None
    best_size = len(pdf_bytes)

    for color_dpi, gray_dpi, jpeg_quality in _compression_ladder(profile):
        start = time.time()
        try:
            output_bytes = _compress_with_ghostscript(
                pdf_bytes,
                color_dpi=color_dpi,
                gray_dpi=gray_dpi,
                jpeg_quality=jpeg_quality,
            )
            output_size = len(output_bytes)
            attempts.append(
                CompressionAttempt(
                    color_dpi=color_dpi,
                    gray_dpi=gray_dpi,
                    jpeg_quality=jpeg_quality,
                    output_size_bytes=output_size,
                    duration_seconds=time.time() - start,
                )
            )
            if output_size < best_size:
                best_bytes = output_bytes
                best_size = output_size
            if output_size <= max_bytes:
                return output_bytes, attempts
        except Exception as error:  # noqa: BLE001 - preserve root cause in attempt log
            attempts.append(
                CompressionAttempt(
                    color_dpi=color_dpi,
                    gray_dpi=gray_dpi,
                    jpeg_quality=jpeg_quality,
                    output_size_bytes=None,
                    duration_seconds=time.time() - start,
                    error=str(error),
                )
            )

    return best_bytes, attempts


def _compression_ladder(profile: str) -> list[tuple[int, int, int]]:
    """Return compression passes for the requested profile."""
    profile_normalized = (profile or "balanced").strip().lower()

    if profile_normalized == "aggressive":
        return [
            (150, 150, 65),
            (120, 120, 55),
            (96, 96, 45),
        ]
    if profile_normalized in {"high_fidelity", "high-fidelity", "fidelity"}:
        return [
            (220, 220, 80),
            (180, 180, 75),
            (150, 150, 70),
        ]

    # Default balanced profile.
    return [
        (180, 180, 75),
        (150, 150, 70),
        (120, 120, 60),
    ]


def _compress_with_ghostscript(
    pdf_bytes: bytes,
    *,
    color_dpi: int,
    gray_dpi: int,
    jpeg_quality: int,
) -> bytes:
    """Compress PDF bytes using Ghostscript."""
    if not shutil.which("gs"):
        raise PDFPreprocessError(
            user_message=(
                "Automatic PDF compression is currently unavailable. "
                "Please retry later or upload a smaller PDF."
            ),
            internal_message="Ghostscript binary not found",
        )

    with tempfile.TemporaryDirectory(prefix="nana_pdf_opt_") as temp_dir:
        input_path = f"{temp_dir}/input.pdf"
        output_path = f"{temp_dir}/output.pdf"

        with open(input_path, "wb") as input_file:
            input_file.write(pdf_bytes)

        command = [
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dDownsampleColorImages=true",
            "-dColorImageDownsampleType=/Bicubic",
            f"-dColorImageResolution={color_dpi}",
            "-dAutoFilterColorImages=false",
            "-dColorImageFilter=/DCTEncode",
            "-dDownsampleGrayImages=true",
            "-dGrayImageDownsampleType=/Bicubic",
            f"-dGrayImageResolution={gray_dpi}",
            "-dAutoFilterGrayImages=false",
            "-dGrayImageFilter=/DCTEncode",
            "-dDownsampleMonoImages=true",
            "-dMonoImageDownsampleType=/Subsample",
            "-dMonoImageResolution=300",
            f"-dJPEGQ={jpeg_quality}",
            f"-sOutputFile={output_path}",
            input_path,
        ]

        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
            )
        except subprocess.CalledProcessError as error:
            stderr = (error.stderr or "").strip()
            raise RuntimeError(f"Ghostscript compression failed: {stderr}") from error
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("Ghostscript compression timed out") from error

        with open(output_path, "rb") as output_file:
            return output_file.read()
