"""Document text extraction — PDF and DOCX support."""
import io

import pdfplumber
from docx import Document


def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    """
    Extract plain text from supported document formats.

    Returns {"extracted_text": str, "page_count": int}.
    """
    try:
        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return _extract_pdf(file_bytes)

        if (
            mime_type
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            or filename.lower().endswith(".docx")
        ):
            return _extract_docx(file_bytes)

        if mime_type and mime_type.startswith("text/") or filename.lower().endswith(".txt"):
            return {
                "extracted_text": file_bytes.decode("utf-8", errors="replace"),
                "page_count": 1,
            }

        if mime_type and mime_type.startswith("image/"):
            return {
                "extracted_text": f"[Image file: {filename}]",
                "page_count": 1,
            }

        return {
            "extracted_text": (
                f"[File: {filename} — unsupported type {mime_type}]"
            ),
            "page_count": 1,
        }
    except Exception as exc:
        return {
            "extracted_text": f"[Extraction failed: {exc!s}]",
            "page_count": 0,
        }


def _extract_pdf(data: bytes) -> dict:
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return {
        "extracted_text": "\n\n".join(text_parts),
        "page_count": len(text_parts),
    }


def _extract_docx(data: bytes) -> dict:
    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return {
        "extracted_text": "\n".join(paragraphs),
        "page_count": 1,
    }
