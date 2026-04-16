"""
Text extraction utilities for AI analysis.
Supports PDF, DOCX, plain text, and images (base64 for Claude vision).
"""

import base64
import io
from pathlib import Path


MAX_TEXT_CHARS = 8000


def extract_text(file_path: str) -> str | None:
    """
    Extract text content from a file.
    Returns extracted text (truncated to MAX_TEXT_CHARS), or None on failure.
    For images, returns None — use extract_image_b64 instead.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    try:
        if suffix == '.pdf':
            return _extract_pdf(file_path)
        elif suffix in ('.docx', '.doc'):
            return _extract_docx(file_path)
        elif suffix == '.txt':
            return _extract_txt(file_path)
        else:
            return None
    except Exception:
        return None


def extract_image_b64(file_path: str) -> tuple[str, str] | None:
    """
    Read an image file and return (base64_data, media_type).
    Returns None if not an image or on read failure.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    media_type_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
    }
    media_type = media_type_map.get(suffix)
    if not media_type:
        return None

    try:
        with open(file_path, 'rb') as f:
            data = base64.standard_b64encode(f.read()).decode('utf-8')
        return data, media_type
    except Exception:
        return None


def _extract_pdf(file_path: str) -> str:
    from pdfminer.high_level import extract_text as pdfminer_extract
    text = pdfminer_extract(file_path)
    return text[:MAX_TEXT_CHARS] if text else ''


def _extract_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    text = '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
    return text[:MAX_TEXT_CHARS]


def _extract_txt(file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read(MAX_TEXT_CHARS)
