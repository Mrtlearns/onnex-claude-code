"""Document text extraction — PDF and DOCX support with chunking for RAG."""
from __future__ import annotations
import io
import re

import pdfplumber
from docx import Document

_CHUNK_SIZE = 500   # target characters per chunk
_CHUNK_OVERLAP = 100  # overlap between consecutive chunks


def chunk_text(text: str, page_map: list[tuple[int, str]] | None = None) -> list[dict]:
    """Split text into overlapping chunks for vector embedding.

    Args:
        text: Full extracted text.
        page_map: Optional list of (page_number, page_text) pairs. When provided,
                  each chunk's page_number is set to the page where the chunk starts.

    Returns:
        List of {"chunk_index": int, "chunk_text": str, "page_number": int}.
    """
    if not text or not text.strip():
        return []

    # Build page-boundary lookup if page_map provided
    page_offsets: list[tuple[int, int]] = []  # (char_offset, page_number)
    if page_map:
        offset = 0
        for page_num, page_text in page_map:
            page_offsets.append((offset, page_num))
            offset += len(page_text) + 2  # +2 for "\n\n" join

    def _page_for_offset(off: int) -> int:
        page = 1
        for po, pn in page_offsets:
            if po <= off:
                page = pn
            else:
                break
        return page

    # Split on paragraph/sentence boundaries first
    paragraphs = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]

    chunks: list[dict] = []
    current = ""
    current_offset = 0
    chunk_index = 0

    for para in paragraphs:
        if len(current) + len(para) + 1 <= _CHUNK_SIZE:
            if current:
                current += "\n" + para
            else:
                current = para
        else:
            if current:
                page = _page_for_offset(current_offset) if page_offsets else 1
                chunks.append({
                    "chunk_index": chunk_index,
                    "chunk_text": current,
                    "page_number": page,
                })
                chunk_index += 1
                # Carry overlap: last _CHUNK_OVERLAP chars into next chunk
                overlap_start = max(0, len(current) - _CHUNK_OVERLAP)
                current = current[overlap_start:] + "\n" + para
                current_offset += overlap_start
            else:
                # Single paragraph exceeds chunk size — split by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    if len(current) + len(sent) + 1 <= _CHUNK_SIZE:
                        current = (current + " " + sent).strip() if current else sent
                    else:
                        if current:
                            page = _page_for_offset(current_offset) if page_offsets else 1
                            chunks.append({
                                "chunk_index": chunk_index,
                                "chunk_text": current,
                                "page_number": page,
                            })
                            chunk_index += 1
                            overlap_start = max(0, len(current) - _CHUNK_OVERLAP)
                            current = current[overlap_start:] + " " + sent
                            current_offset += overlap_start
                        else:
                            current = sent

    if current.strip():
        page = _page_for_offset(current_offset) if page_offsets else 1
        chunks.append({
            "chunk_index": chunk_index,
            "chunk_text": current.strip(),
            "page_number": page,
        })

    return chunks


def extract_text_with_chunks(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    """Extract text AND produce chunks for RAG. Returns full extract_text result
    plus a 'chunks' key with list of chunk dicts."""
    result = extract_text(file_bytes, mime_type, filename)
    text = result.get("extracted_text", "")

    # For PDFs, build page_map so chunks carry correct page numbers
    page_map: list[tuple[int, str]] | None = None
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                page_map = []
                for i, page in enumerate(pdf.pages, 1):
                    pt = page.extract_text() or ""
                    page_map.append((i, pt))
        except Exception:
            page_map = None

    result["chunks"] = chunk_text(text, page_map)
    return result


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
