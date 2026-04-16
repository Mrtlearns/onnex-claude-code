#!/usr/bin/env python3
"""
Core MSG extraction engine.
Wraps the extract-msg library into a clean, reusable class.

Install: pip install extract-msg
"""

import re
import tempfile
from pathlib import Path

import extract_msg

# ── Email decoration filtering ────────────────────────────────────────────────

_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
               '.tif', '.tiff', '.wmf', '.emf'}

_DECORATION_SIZE_BYTES = 15 * 1024  # 15 KB

_DECORATION_RE = re.compile(
    r'^(image\d+|att\d+|outlook-[0-9a-f\-]+'
    r'|(logo|banner|signature|sig|footer|header|badge|seal|icon|spacer'
    r'|bullet|arrow|bg|background|divider|separator|border).*)'
    r'\.(jpg|jpeg|png|gif|bmp|ico|svg|webp|tif|tiff|wmf|emf)$',
    re.IGNORECASE,
)


def _decoration_check(filename: str, size_bytes: int) -> tuple[bool, str]:
    """Return (is_decoration, reason) for an attachment."""
    ext = Path(filename).suffix.lower()
    if ext not in _IMAGE_EXTS:
        return False, ''
    if _DECORATION_RE.match(filename):
        kb = round(size_bytes / 1024, 1)
        return True, f'Email decoration — filename pattern [{filename}] ({kb} KB)'
    if size_bytes < _DECORATION_SIZE_BYTES:
        kb = round(size_bytes / 1024, 1)
        return True, f'Email decoration — small image ({kb} KB, threshold 15 KB)'
    return False, ''


def _safe_dirname(subject: str) -> str:
    """Convert an email subject to a safe filesystem directory name."""
    safe = re.sub(r'[\\/*?:"<>|]', '_', subject or 'unknown')
    return safe[:80].strip() or 'unknown'


class MSGExtractor:
    def __init__(self, output_base_dir: str = ""):
        self.output_base_dir = Path(output_base_dir) if output_base_dir else Path(tempfile.gettempdir()) / "msg_extractions"
        self.attachments_dir = self.output_base_dir / "attachments"
        self.attachments_dir.mkdir(parents=True, exist_ok=True)

    def extract_single_msg(self, msg_path: str) -> dict:
        """
        Extract a single .msg file.

        Returns a dict with keys:
            success, file, subject, sender, to, date, body, attachments
        On failure:
            success, file, error
        """
        try:
            msg = extract_msg.openMsg(msg_path)

            subject = msg.subject or 'No Subject'
            sender  = msg.sender  or ''
            to      = msg.to      or ''
            date    = str(msg.date) if msg.date else ''
            body    = msg.body    or ''

            # Save attachments under a folder named after the subject
            folder_name = _safe_dirname(subject)
            att_folder  = self.attachments_dir / folder_name
            att_folder.mkdir(parents=True, exist_ok=True)

            attachments = []
            for att in msg.attachments:
                try:
                    filename = att.longFilename or att.shortFilename or 'attachment'
                    att_path = att_folder / filename
                    att_path.write_bytes(att.data)
                    size_bytes = len(att.data)
                    is_deco, deco_reason = _decoration_check(filename, size_bytes)
                    attachments.append({
                        'filename':     filename,
                        'size_bytes':   size_bytes,
                        'path':         str(att_path),
                        'folder':       folder_name,
                        'filtered':     is_deco,
                        'filter_reason': deco_reason,
                    })
                except Exception as e:
                    attachments.append({'error': str(e)})

            msg.close()

            return {
                'success':     True,
                'file':        msg_path,
                'subject':     subject,
                'sender':      sender,
                'to':          to,
                'date':        date,
                'body':        body,
                'attachments': attachments,
            }

        except Exception as e:
            return {
                'success': False,
                'file':    msg_path,
                'error':   str(e),
            }
