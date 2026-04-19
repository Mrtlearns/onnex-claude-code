"""PDF report generation — SSP and POA&M via ReportLab."""
from __future__ import annotations

import io
from datetime import datetime, date

import asyncpg
from minio import Minio
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)

from app.config import settings as _settings
from app.services.minio_service import upload_bytes, get_proxy_download_url, ensure_bucket

REPORTS_BUCKET = "cmmc-reports"

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading1"],
            fontSize=14,
            spaceAfter=6,
            spaceBefore=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubHeading",
            parent=styles["Heading2"],
            fontSize=11,
            spaceAfter=4,
            spaceBefore=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodySmall",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
        )
    )
    return styles


def _add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(
        letter[0] - 0.5 * inch,
        0.5 * inch,
        f"Page {doc.page}",
    )
    canvas.restoreState()


def _cell(text: str | None, style) -> Paragraph:
    return Paragraph(str(text or ""), style)


# ---------------------------------------------------------------------------
# SSP PDF
# ---------------------------------------------------------------------------


async def generate_ssp_pdf(
    program_id: str,
    conn: asyncpg.Connection,
    minio_client: Minio,
    minio_public: Minio | None = None,
) -> str:
    """Generate an SSP PDF and upload it to MinIO. Returns presigned download URL."""
    # ---- fetch program + org ------------------------------------------------
    program = await conn.fetchrow(
        """
        SELECT p.*, o.name AS org_name, o.cage_code AS org_cage_code
        FROM programs p
        JOIN orgs o ON p.org_id = o.id
        WHERE p.id = $1
        """,
        program_id,
    )
    if not program:
        raise ValueError(f"Program {program_id} not found")

    # ---- fetch controls (parent controls only, not objectives) ---------------
    controls = await conn.fetch(
        """
        SELECT
            cd.nist_id,
            cd.cmmc_id,
            cd.family,
            cd.requirement_text,
            pc.status,
            pc.implementation_notes
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.program_id = $1
          AND cd.is_objective = FALSE
          AND pc.is_applicable = TRUE
        ORDER BY cd.far_above_phase, cd.nist_sort_order
        """,
        program_id,
    )

    styles = _styles()
    story = []
    today = datetime.utcnow().strftime("%B %d, %Y")

    # ---- Title page ----------------------------------------------------------
    story.append(Spacer(1, 2 * inch))
    story.append(Paragraph("System Security Plan", styles["Title"]))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(f"Organization: {program['org_name']}", styles["Heading2"]))
    story.append(Paragraph(f"System: {program.get('system_name') or program['name']}", styles["Heading2"]))
    story.append(Paragraph(f"Date: {today}", styles["Normal"]))
    story.append(PageBreak())

    # ---- Section 1: System Overview ------------------------------------------
    story.append(Paragraph("1. System Overview", styles["SectionHeading"]))
    story.append(Paragraph(f"<b>System Name:</b> {program.get('system_name') or program['name']}", styles["Normal"]))
    cage_codes = program.get("cage_codes") or []
    if isinstance(cage_codes, str):
        cage_codes = [cage_codes]
    story.append(Paragraph(f"<b>CAGE Code(s):</b> {', '.join(cage_codes) if cage_codes else 'N/A'}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))
    desc = program.get("ssp_system_description") or "Not yet provided."
    story.append(Paragraph(f"<b>System Description:</b><br/>{desc}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Section 2: Environment of Operation ---------------------------------
    story.append(Paragraph("2. Environment of Operation", styles["SectionHeading"]))
    env = program.get("ssp_environment_of_operation") or "Not yet provided."
    story.append(Paragraph(env, styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Section 3: CUI Types ------------------------------------------------
    story.append(Paragraph("3. CUI Information Types", styles["SectionHeading"]))
    info_types = program.get("ssp_information_types") or "Not yet provided."
    story.append(Paragraph(info_types, styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Section 4: Implementation Status ------------------------------------
    story.append(Paragraph("4. Control Implementation Status", styles["SectionHeading"]))
    cell_style = styles["BodySmall"]
    header_style = ParagraphStyle(
        name="TableHeader", parent=cell_style, textColor=colors.white,
        fontName="Helvetica-Bold", fontSize=8,
    )
    table_data = [[
        Paragraph(h, header_style)
        for h in ["NIST ID", "CMMC ID", "Family", "Status", "Implementation Notes"]
    ]]
    for row in controls:
        notes = row.get("implementation_notes") or ""
        table_data.append([
            _cell(row["nist_id"], cell_style),
            _cell(row.get("cmmc_id") or "", cell_style),
            _cell(row.get("family") or "", cell_style),
            _cell((row.get("status") or "").replace("_", " ").title(), cell_style),
            _cell(notes, cell_style),
        ])

    col_widths = [0.8 * inch, 0.8 * inch, 1.2 * inch, 1.1 * inch, 3.6 * inch]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f4f7")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(tbl)
    story.append(Spacer(1, 0.2 * inch))

    # ---- Section 5: Topology -------------------------------------------------
    story.append(Paragraph("5. System Topology", styles["SectionHeading"]))
    topo = program.get("topology_narrative") or "Not yet provided."
    story.append(Paragraph(topo, styles["Normal"]))
    diagram_url = program.get("topology_diagram_url")
    if diagram_url:
        story.append(Spacer(1, 0.1 * inch))
        story.append(Paragraph(f"Network diagram: {diagram_url}", styles["Normal"]))

    # ---- Build PDF ----------------------------------------------------------
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=0.75 * inch, leftMargin=0.75 * inch,
                            topMargin=1 * inch, bottomMargin=0.75 * inch)
    doc.build(story, onFirstPage=_add_page_number, onLaterPages=_add_page_number)
    pdf_bytes = buf.getvalue()

    # ---- Upload & presign ---------------------------------------------------
    ensure_bucket(minio_client, REPORTS_BUCKET)
    key = f"{program_id}/ssp_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    upload_bytes(minio_client, REPORTS_BUCKET, key, pdf_bytes, "application/pdf")
    return get_proxy_download_url(REPORTS_BUCKET, key, _settings.api_url, _settings.webhook_secret)


# ---------------------------------------------------------------------------
# POA&M PDF
# ---------------------------------------------------------------------------


async def generate_poam_pdf(
    program_id: str,
    conn: asyncpg.Connection,
    minio_client: Minio,
    minio_public: Minio | None = None,
) -> str:
    """Generate a POA&M PDF and upload it to MinIO. Returns presigned download URL."""
    program = await conn.fetchrow(
        """
        SELECT p.*, o.name AS org_name
        FROM programs p
        JOIN orgs o ON p.org_id = o.id
        WHERE p.id = $1
        """,
        program_id,
    )
    if not program:
        raise ValueError(f"Program {program_id} not found")

    # Only non-fully-implemented applicable controls
    controls = await conn.fetch(
        """
        SELECT
            cd.nist_id,
            cd.cmmc_id,
            cd.requirement_text,
            pc.status,
            pc.implementation_notes,
            pc.target_completion_date
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.program_id = $1
          AND cd.is_objective = FALSE
          AND pc.is_applicable = TRUE
          AND pc.status != 'fully_implemented'
        ORDER BY cd.far_above_phase, cd.nist_sort_order
        """,
        program_id,
    )

    styles = _styles()
    story = []
    today = datetime.utcnow().strftime("%B %d, %Y")

    # ---- Title page ----------------------------------------------------------
    story.append(Spacer(1, 2 * inch))
    story.append(Paragraph("Plan of Action & Milestones", styles["Title"]))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(f"Organization: {program['org_name']}", styles["Heading2"]))
    story.append(Paragraph(f"System: {program.get('system_name') or program['name']}", styles["Heading2"]))
    story.append(Paragraph(f"Date: {today}", styles["Normal"]))
    story.append(PageBreak())

    # ---- POA&M Table ---------------------------------------------------------
    story.append(Paragraph("Open Items", styles["SectionHeading"]))
    if not controls:
        story.append(Paragraph("No open items — all applicable controls are fully implemented.", styles["Normal"]))
    else:
        cell_style = styles["BodySmall"]
        header_style = ParagraphStyle(
            name="TableHeader", parent=cell_style, textColor=colors.white,
            fontName="Helvetica-Bold", fontSize=8,
        )
        table_data = [[
            Paragraph(h, header_style)
            for h in ["Control ID", "Description", "Status", "Responsible Org", "Resources", "Milestone Date", "Remediation Plan"]
        ]]
        for row in controls:
            desc = row.get("requirement_text") or ""
            milestone = row.get("target_completion_date")
            milestone_str = milestone.strftime("%Y-%m-%d") if isinstance(milestone, date) else (str(milestone)[:10] if milestone else "TBD")
            notes = row.get("implementation_notes") or ""
            table_data.append([
                _cell(row["nist_id"], cell_style),
                _cell(desc, cell_style),
                _cell((row.get("status") or "").replace("_", " ").title(), cell_style),
                _cell(program["org_name"], cell_style),
                _cell("TBD", cell_style),
                _cell(milestone_str, cell_style),
                _cell(notes or "Remediation plan pending.", cell_style),
            ])

        # Landscape letter = 11" wide; 9.5" usable after margins
        col_widths = [0.65 * inch, 2.0 * inch, 1.0 * inch, 1.2 * inch, 0.75 * inch, 0.9 * inch, 2.95 * inch]
        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f4f7")]),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(tbl)

    # ---- Build PDF ----------------------------------------------------------
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter), rightMargin=0.75 * inch, leftMargin=0.75 * inch,
                            topMargin=1 * inch, bottomMargin=0.75 * inch)
    doc.build(story, onFirstPage=_add_page_number, onLaterPages=_add_page_number)
    pdf_bytes = buf.getvalue()

    # ---- Upload & presign ---------------------------------------------------
    ensure_bucket(minio_client, REPORTS_BUCKET)
    key = f"{program_id}/poam_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    upload_bytes(minio_client, REPORTS_BUCKET, key, pdf_bytes, "application/pdf")
    return get_proxy_download_url(REPORTS_BUCKET, key, _settings.api_url, _settings.webhook_secret)
