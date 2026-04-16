"""
Generate simulated RT (Radiographic Testing) engineering drawing PDFs for NDT Portal testing.

Each drawing is a realistic engineering document containing:
  - Part geometry / cross-section view
  - Scan geometry overlay (source position, film position, angles)
  - Dimensional callouts
  - Material / acceptance standard notes
  - Title block with embedded PII (for comply/sanitize/redaction testing)

Parts covered:
  DWG-001  Carbon steel flat-plate butt weld           — simple, single angle, 1 film
  DWG-002  8" NPS SCH 80 carbon steel pipe elbow       — 3 scan positions, 4×10 films
  DWG-003  Aluminum aerospace investment casting       — 4 views, mixed film sizes
  DWG-004  Inconel 718 turbine disk segment            — 6 slices, high kV, complex geometry
  DWG-005  SS304 pressure vessel nozzle-to-shell weld  — tangential + straight shots, 3 films
  DWG-006  OVERSIZE: aerospace fuselage panel          — EDGE CASE, exceeds all machine envelopes

Run:  python generate_rt_diagrams.py
Output: ./  (same directory, 6 PDF files)
"""

import os
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.lines as mlines
from matplotlib.patches import FancyArrowPatch, Arc, Wedge, FancyBboxPatch
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Shared PII / Company data (for title block — will be redacted by comply) ──
COMPANY_NAME    = "Aero-Precision Components, LLC"
COMPANY_ADDR1   = "4501 Westpark Drive, Suite 200"
COMPANY_ADDR2   = "Houston, TX  77041"
ENGINEER_NAME   = "John A. Whitmore, PE"
ENGINEER_EMAIL  = "j.whitmore@aeroprecision.com"
ENGINEER_PHONE  = "713-445-8821"
CHECKER_NAME    = "Sandra L. Reyes"
CHECKER_EMAIL   = "s.reyes@aeroprecision.com"
APPROVER_NAME   = "Marcus T. Hoffmann"
APPROVER_EMAIL  = "m.hoffmann@aeroprecision.com"
APPROVER_PHONE  = "713-445-8856"
CAGE_CODE       = "3F7K2"
CONTRACT_NO     = "FA8649-24-C-0187"

NAVY  = '#1A2E4A'
BLUE  = '#1F5C99'
AMBER = '#D97B06'
MUTED = '#6B7280'
RED   = '#C0392B'
GREEN = '#1A7A3C'
LIGHT = '#EBF3FB'
WHITE = '#FFFFFF'


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def new_fig(w=17, h=11):
    fig = plt.figure(figsize=(w, h), facecolor='white')
    return fig


def draw_title_block(fig, dwg_no, rev, title, part_no, material, scale,
                     sheet='1 of 1', date='2024-11-14'):
    """Draw an ASME-style title block in the bottom-right of the figure."""
    # Outer border
    border = plt.axes([0.01, 0.01, 0.98, 0.98], frameon=True)
    border.set_xlim(0, 1); border.set_ylim(0, 1)
    border.set_xticks([]); border.set_yticks([])
    for spine in border.spines.values():
        spine.set_linewidth(2); spine.set_color(NAVY)
    border.patch.set_alpha(0)

    # Title block box — bottom strip
    tb = plt.axes([0.01, 0.01, 0.98, 0.16], frameon=True)
    tb.set_xlim(0, 100); tb.set_ylim(0, 100)
    tb.set_xticks([]); tb.set_yticks([])
    for spine in tb.spines.values():
        spine.set_linewidth(1.5); spine.set_color(NAVY)
    tb.patch.set_facecolor('#F0F4F8')

    # Left column — company block
    tb.add_patch(mpatches.FancyBboxPatch((0.5, 0.5), 38, 99, boxstyle='square,pad=0',
                                          ec=NAVY, fc='white', lw=1))
    tb.text(19, 90, COMPANY_NAME, ha='center', va='top', fontsize=9,
            fontweight='bold', color=NAVY)
    tb.text(19, 80, COMPANY_ADDR1, ha='center', va='top', fontsize=7, color=MUTED)
    tb.text(19, 73, COMPANY_ADDR2, ha='center', va='top', fontsize=7, color=MUTED)
    tb.text(19, 63, f'Ph: {ENGINEER_PHONE}', ha='center', va='top', fontsize=7, color=MUTED)
    tb.text(19, 56, f'Email: {ENGINEER_EMAIL}', ha='center', va='top', fontsize=6.5, color=MUTED)
    tb.text(19, 48, f'CAGE: {CAGE_CODE}   Contract: {CONTRACT_NO}',
            ha='center', va='top', fontsize=6, color=MUTED)

    # Signatures block
    for i, (label, name, email) in enumerate([
        ('DWN', ENGINEER_NAME, ENGINEER_EMAIL),
        ('CHK', CHECKER_NAME,  CHECKER_EMAIL),
        ('APV', APPROVER_NAME, APPROVER_EMAIL),
    ]):
        y = 35 - i * 12
        tb.text(1, y, label, va='top', fontsize=7, fontweight='bold', color=NAVY)
        tb.text(8, y, name,  va='top', fontsize=7, color='black')
        tb.text(8, y - 6, email, va='top', fontsize=6, color=MUTED)
        tb.axhline(y + 1, xmin=0.005, xmax=0.39, color=NAVY, lw=0.5)

    # Center column — title / part info
    tb.add_patch(mpatches.FancyBboxPatch((38.5, 0.5), 38, 99, boxstyle='square,pad=0',
                                          ec=NAVY, fc='white', lw=1))
    tb.text(57.5, 90, title.upper(), ha='center', va='top', fontsize=10,
            fontweight='bold', color=NAVY)
    tb.axhline(81, xmin=0.385, xmax=0.775, color=NAVY, lw=0.5)
    tb.text(39.5, 78, 'PART NO:', va='top', fontsize=7, fontweight='bold', color=NAVY)
    tb.text(52, 78, part_no, va='top', fontsize=8, color='black')
    tb.text(39.5, 68, 'MATERIAL:', va='top', fontsize=7, fontweight='bold', color=NAVY)
    tb.text(52, 68, material, va='top', fontsize=7.5, color='black')
    tb.text(39.5, 58, 'SCALE:', va='top', fontsize=7, fontweight='bold', color=NAVY)
    tb.text(52, 58, scale, va='top', fontsize=7.5, color='black')
    tb.text(39.5, 48, 'SHEET:', va='top', fontsize=7, fontweight='bold', color=NAVY)
    tb.text(52, 48, sheet, va='top', fontsize=7.5, color='black')
    tb.text(39.5, 38, 'DATE:', va='top', fontsize=7, fontweight='bold', color=NAVY)
    tb.text(52, 38, date, va='top', fontsize=7.5, color='black')
    # NDT callout
    tb.add_patch(mpatches.FancyBboxPatch((39, 4), 36, 22,
                 boxstyle='round,pad=1', ec=AMBER, fc='#FFF8E1', lw=1.5))
    tb.text(57.5, 21, 'NDT REQUIREMENT: RADIOGRAPHIC TESTING',
            ha='center', va='top', fontsize=7, fontweight='bold', color=AMBER)
    tb.text(57.5, 14, 'Per ASME Sec V Art. 2 / ASTM E94',
            ha='center', va='top', fontsize=6.5, color='black')
    tb.text(57.5, 8, f'Contact: {APPROVER_EMAIL}  |  {APPROVER_PHONE}',
            ha='center', va='top', fontsize=6, color=MUTED)

    # Right column — drawing number / revision
    tb.add_patch(mpatches.FancyBboxPatch((77, 0.5), 22.5, 99, boxstyle='square,pad=0',
                                          ec=NAVY, fc='white', lw=1))
    tb.text(88.5, 90, 'DRAWING NO.', ha='center', va='top', fontsize=7,
            fontweight='bold', color=NAVY)
    tb.text(88.5, 78, dwg_no, ha='center', va='top', fontsize=11,
            fontweight='bold', color=NAVY)
    tb.axhline(69, xmin=0.77, xmax=0.995, color=NAVY, lw=0.5)
    tb.text(88.5, 65, f'REV: {rev}', ha='center', va='top', fontsize=9,
            fontweight='bold', color=RED)
    tb.axhline(56, xmin=0.77, xmax=0.995, color=NAVY, lw=0.5)
    tb.text(88.5, 52, 'CLASSIFICATION', ha='center', va='top', fontsize=7,
            fontweight='bold', color=NAVY)
    tb.text(88.5, 43, 'DISTRIBUTION D', ha='center', va='top', fontsize=8,
            fontweight='bold', color=RED)
    tb.text(88.5, 34, 'LIMITED', ha='center', va='top', fontsize=8,
            fontweight='bold', color=RED)
    tb.axhline(25, xmin=0.77, xmax=0.995, color=NAVY, lw=0.5)
    tb.text(78, 21, 'EXPORT CTRL:', va='top', fontsize=6.5,
            fontweight='bold', color=NAVY)
    tb.text(78, 14, 'EAR / ECCN 2B350', va='top', fontsize=7, color=RED)
    tb.text(78, 7, f'Approved: {APPROVER_NAME[:16]}', va='top', fontsize=6, color=MUTED)


def add_scan_legend(ax, x, y, items):
    """Add a small scan geometry legend box."""
    box = FancyBboxPatch((x, y), 3.8, len(items) * 0.45 + 0.3,
                          boxstyle='round,pad=0.05', ec=NAVY, fc=LIGHT, lw=0.8,
                          transform=ax.transData)
    ax.add_patch(box)
    for i, (color, label) in enumerate(items):
        cy = y + len(items) * 0.45 - i * 0.45 + 0.1
        ax.plot([x + 0.2, x + 0.7], [cy, cy], color=color, lw=2)
        ax.text(x + 0.9, cy, label, va='center', fontsize=7, color='black')


def arrow(ax, x0, y0, x1, y1, color='black', lw=1.5, head=0.2):
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle=f'-|>', color=color, lw=lw,
                                mutation_scale=head * 60))


def dim_line(ax, x0, y0, x1, y1, label, offset=0.3, color=NAVY, fs=7.5):
    """Draw a simple dimension line with label."""
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle='<->', color=color, lw=1,
                                mutation_scale=10))
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    if abs(y1 - y0) < 0.01:   # horizontal
        ax.text(mx, my + offset, label, ha='center', va='bottom', fontsize=fs, color=color)
    else:                       # vertical
        ax.text(mx + offset, my, label, ha='left', va='center', fontsize=fs, color=color)


def note_box(ax, x, y, lines, color=NAVY):
    txt = '\n'.join(lines)
    ax.text(x, y, txt, va='top', fontsize=7, color=color,
            bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-001  Carbon steel flat-plate butt weld  (SIMPLE — single angle, 1 film)
# Machine fit: UNIT-2 or UNIT-3 (classical cabinet)
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg001():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — BUTT WELD / FLAT PLATE',
                 fontsize=12, fontweight='bold', color=NAVY, pad=10)

    # ── PLAN VIEW (top) ──────────────────────────────────────────────────────
    ax.text(10, 12.2, 'VIEW A — PLAN (TOP)',
            ha='center', fontsize=9, fontweight='bold', color=MUTED)

    # Plate outline — 500mm × 250mm, weld along centre
    plate = mpatches.Rectangle((2, 9.5), 16, 2.5, ec=NAVY, fc='#D0D8E4', lw=2)
    ax.add_patch(plate)
    # Weld bead cap reinforcement
    weld_cap = mpatches.FancyBboxPatch((9.7, 9.45), 0.6, 2.6,
                                        boxstyle='round,pad=0.1', ec=AMBER, fc='#FFE0A0', lw=1.5)
    ax.add_patch(weld_cap)
    ax.text(10, 10.75, 'WELD\nBEAD', ha='center', va='center', fontsize=6.5,
            fontweight='bold', color='#7A4A00')

    # Film placement (dashed rectangle under plate)
    film = mpatches.Rectangle((6, 9.3), 8, 0.2, ec=GREEN, fc='#C8F0D8', lw=1.5,
                               linestyle='--')
    ax.add_patch(film)
    ax.text(10, 9.1, 'FILM: 7×17"  IQI ASTM 12 WIRE SET', ha='center',
            fontsize=7.5, color=GREEN, fontweight='bold')

    # X-ray source (circle above plate)
    ax.add_patch(plt.Circle((10, 13.5), 0.35, ec=RED, fc='#FFCCCC', lw=2, zorder=5))
    ax.text(10, 13.5, 'S', ha='center', va='center', fontsize=9,
            fontweight='bold', color=RED)
    # Central beam arrow
    arrow(ax, 10, 13.15, 10, 12.05, color=RED, lw=2, head=0.25)
    ax.text(10.3, 12.6, 'CENTRAL BEAM\n90° (NORMAL)', fontsize=7, color=RED)

    # Beam cone lines
    for xf, xt in [(6, 7.5), (14, 12.5)]:
        ax.plot([10, xf], [13.15, 12.05], color=RED, lw=0.8, ls='--', alpha=0.5)

    # FFD dimension line
    dim_line(ax, 10.5, 13.15, 10.5, 12.05, 'FFD = 1016 mm (40")', offset=0.4)

    # Weld seam plan dimensions
    dim_line(ax, 2, 9.4, 18, 9.4, '500 mm', offset=-0.25)
    dim_line(ax, 1.8, 9.5, 1.8, 12.0, '250 mm', offset=-0.3)

    # ── CROSS-SECTION VIEW ───────────────────────────────────────────────────
    ax.text(5, 8.4, 'SECTION B-B — WELD CROSS SECTION',
            ha='center', fontsize=8.5, fontweight='bold', color=MUTED)

    # Plate thickness cross-section
    for xi in [1.5, 5]:
        section = mpatches.Rectangle((xi, 5.5), 2.5, 1.8, ec=NAVY, fc='#D0D8E4', lw=1.5)
        ax.add_patch(section)
    # Weld crown profile
    weld_x = [4, 4.3, 4.5, 4.75, 5]
    weld_y = [7.3, 7.5, 7.65, 7.5, 7.3]
    ax.fill_between(weld_x, [5.5]*5, weld_y, color='#FFE0A0', alpha=0.9, zorder=3)
    ax.plot(weld_x, weld_y, color=AMBER, lw=2)
    ax.plot([4, 5], [5.5, 5.5], color=AMBER, lw=2)

    dim_line(ax, 1.3, 5.5, 1.3, 7.3, '12 mm', offset=-0.4)
    ax.text(4.5, 5.1, 'CAP: +1.5 mm max reinf.', ha='center',
            fontsize=6.5, color=AMBER)

    # IQI position (film side)
    ax.add_patch(mpatches.Rectangle((1.6, 5.35), 1.0, 0.12, ec=GREEN, fc='#C8F0D8', lw=1))
    ax.text(2.1, 5.2, 'IQI — FILM SIDE\n(source side pref.)', ha='center',
            fontsize=6, color=GREEN)

    # ── SCAN SCHEDULE TABLE ──────────────────────────────────────────────────
    ax.text(14, 8.4, 'SCAN SCHEDULE', ha='center', fontsize=9,
            fontweight='bold', color=NAVY)
    headers = ['SHOT', 'kV', 'mA', 'FFD(mm)', 'FILM', 'IQI', 'TIME(min)']
    widths  = [1.0, 1.0, 0.8, 1.5, 1.5, 1.5, 1.5]
    col_x   = [10.5, 11.5, 12.5, 13.3, 14.8, 16.3, 17.8]
    for j, (h, x) in enumerate(zip(headers, col_x)):
        ax.text(x, 7.9, h, ha='center', fontsize=7, fontweight='bold',
                color=WHITE,
                bbox=dict(boxstyle='square,pad=0.2', fc=NAVY, ec=NAVY))

    row = ['1', '120', '5.0', '1016', '7×17 D4', 'ASTM 12W SS', '6']
    for j, (val, x) in enumerate(zip(row, col_x)):
        ax.text(x, 7.25, val, ha='center', fontsize=7.5, color='black')

    ax.plot([10.2, 19.5], [7.6, 7.6], color=NAVY, lw=0.5)
    ax.plot([10.2, 19.5], [6.9, 6.9], color=MUTED, lw=0.3, ls='--')

    # ── NOTES ────────────────────────────────────────────────────────────────
    note_box(ax, 10.3, 6.5, [
        'NOTES:',
        '1. Weld meets ASME Sec VIII Div 1 UW-51',
        '2. Film: Kodak AA400 / Fuji IX100, D4 class',
        '3. IQI ASTM E747 Wire Set, 2T sensitivity',
        '4. Geometric unsharpness Ug ≤ 0.51mm (per SE-94)',
        '5. Machine: UNIT-2 or UNIT-3 (classical cabinet)',
        '6. Part weight: ~18 kg — no handling concern',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-001-C', rev='B',
                     title='Carbon Steel Flat Plate Butt Weld\nRadiographic Test Plan',
                     part_no='FPW-CS-500-A36',
                     material='ASTM A36 Carbon Steel',
                     scale='1:10', sheet='1 of 1', date='2024-11-14')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-002  8" NPS SCH 80 carbon steel pipe elbow  (3 shot positions, 4×10 films)
# Machine fit: UNIT-3 (320kV) or UNIT-1 Walk-In
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg002():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — PIPE ELBOW WELD (8" NPS SCH 80)',
                 fontsize=11, fontweight='bold', color=NAVY, pad=10)

    # ── ISOMETRIC SKETCH ─────────────────────────────────────────────────────
    ax.text(5, 12.5, 'ISOMETRIC VIEW — ELBOW ASSEMBLY', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Pipe A (horizontal)
    ax.add_patch(mpatches.FancyBboxPatch((0.5, 8.0), 5.0, 1.8,
                  boxstyle='round,pad=0.05', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.text(3.0, 8.9, '8" NPS SCH 80\nOD=219.1mm  WT=12.7mm', ha='center',
            va='center', fontsize=7, color=NAVY)

    # 90° elbow body
    theta = np.linspace(np.pi, np.pi * 1.5, 60)
    r_out, r_in = 3.5, 2.0
    cx_e, cy_e = 5.5, 6.0
    x_out = cx_e + r_out * np.cos(theta)
    y_out = cy_e + r_out * np.sin(theta)
    x_in  = cx_e + r_in  * np.cos(theta[::-1])
    y_in  = cy_e + r_in  * np.sin(theta[::-1])
    ax.fill(np.concatenate([x_out, x_in]),
            np.concatenate([y_out, y_in]), color='#C8D8EC', zorder=2)
    ax.plot(x_out, y_out, color=NAVY, lw=2)
    ax.plot(x_in,  y_in,  color=NAVY, lw=2)

    # Pipe B (vertical drop)
    ax.add_patch(mpatches.FancyBboxPatch((5.5, 2.5), 1.8, 3.55,
                  boxstyle='round,pad=0.05', ec=NAVY, fc='#C8D8EC', lw=2))

    # Weld locations (orange rings)
    for wx, wy, label in [(5.5, 8.0, 'WELD A'), (5.5, 6.0, 'WELD B'), (5.5, 2.5, 'WELD C')]:
        ax.add_patch(plt.Circle((wx + 0.9, wy), 0.25, ec=AMBER, fc='#FFE0A0',
                                 lw=2, zorder=5))
        ax.text(wx + 1.8, wy, label, va='center', fontsize=8,
                fontweight='bold', color=AMBER)

    # ── SHOT POSITIONS (plan view insets) ────────────────────────────────────
    ax.text(11.5, 12.5, 'SHOT POSITIONS (CROSS-SECTION AT EACH WELD)',
            ha='center', fontsize=9, fontweight='bold', color=MUTED)

    shot_colors = [RED, '#8B1A8B', '#0A6A3A']
    shot_data = [
        ('SHOT 1 — WELD A\n(0° / straight)', 10.5, 10.0),
        ('SHOT 2 — WELD B\n(ellipse technique)', 14.0, 10.0),
        ('SHOT 3 — WELD C\n(tangential shot)', 17.5, 10.0),
    ]

    for (label, sx, sy), scolor in zip(shot_data, shot_colors):
        # Pipe cross section
        ax.add_patch(plt.Circle((sx, sy - 0.5), 1.05, ec=NAVY, fc='#C8D8EC',
                                 lw=1.5, zorder=3))
        ax.add_patch(plt.Circle((sx, sy - 0.5), 0.7, ec=NAVY, fc='white',
                                 lw=1, zorder=4))
        # Source position
        ax.add_patch(plt.Circle((sx, sy - 0.5 + 2.0), 0.25, ec=scolor, fc='#FFCCCC',
                                 lw=2, zorder=5))
        ax.text(sx, sy - 0.5 + 2.0, 'S', ha='center', va='center',
                fontsize=7, fontweight='bold', color=scolor)
        arrow(ax, sx, sy - 0.5 + 1.75, sx, sy - 0.5 + 1.15,
              color=scolor, lw=1.5, head=0.15)
        # Film (arc or flat)
        if 'ellipse' in label:
            arc = Arc((sx, sy - 0.5), 2.8, 2.8, angle=0, theta1=200, theta2=340,
                      color=GREEN, lw=2)
            ax.add_patch(arc)
        else:
            ax.plot([sx - 1.2, sx + 1.2], [sy - 0.5 - 1.6, sy - 0.5 - 1.6],
                    color=GREEN, lw=2.5)
        ax.text(sx, sy - 0.5 - 2.1, '4×10 D5 film', ha='center',
                fontsize=6.5, color=GREEN)
        ax.text(sx, sy + 1.8, label, ha='center', fontsize=7.5,
                fontweight='bold', color=scolor)

    # ── SCHEDULE ─────────────────────────────────────────────────────────────
    ax.text(10, 6.5, 'EXPOSURE SCHEDULE', ha='center', fontsize=9,
            fontweight='bold', color=NAVY)
    headers = ['SHOT', 'WELD', 'TECHNIQUE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'TIME(min)']
    col_x   = [9.2, 9.9, 11.0, 12.2, 13.0, 13.8, 15.0, 16.5]
    for h, x in zip(headers, col_x):
        ax.text(x, 6.1, h, ha='center', fontsize=6.5, fontweight='bold',
                color=WHITE, bbox=dict(boxstyle='square,pad=0.15', fc=NAVY, ec=NAVY))
    rows = [
        ['1', 'A', 'STRAIGHT', '180', '4.5', '762', '4×10 D5', '8'],
        ['2', 'B', 'ELLIPSE',  '180', '4.5', '762', '4×10 D5', '10'],
        ['3', 'C', 'TANGENTIAL','200', '5.0', '812', '4×10 D5', '12'],
    ]
    for ri, row in enumerate(rows):
        ry = 5.5 - ri * 0.7
        bg = LIGHT if ri % 2 == 0 else 'white'
        ax.add_patch(mpatches.FancyBboxPatch((9.0, ry - 0.15), 8.2, 0.55,
                      boxstyle='square,pad=0', fc=bg, ec='none', zorder=1))
        for val, x in zip(row, col_x):
            ax.text(x, ry + 0.1, val, ha='center', fontsize=7, color='black', zorder=2)

    note_box(ax, 9.0, 3.5, [
        'NOTES:',
        '1. Welds per ASME B31.3 Process Piping, 100% RT',
        '2. Film: Agfa D5, min 150mm beyond weld toe each end',
        '3. IQI ASTM E747 Penetrameter, 2% sensitivity',
        '4. Density range 2.0–4.0 for ASTM E94',
        '5. Machine: UNIT-3 (Comet MXR320/26) or UNIT-1 (Walk-In)',
        f'6. Contact NDT Eng: {ENGINEER_NAME}  {ENGINEER_PHONE}',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-002-D', rev='C',
                     title='8" NPS SCH 80 Pipe Elbow\nButt Weld RT Plan (3 Shots)',
                     part_no='ELB-CS-8NPS-90-LR',
                     material='ASTM A234 WPB Carbon Steel',
                     scale='1:8', sheet='1 of 2', date='2024-11-14')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-003  Aluminum aerospace investment casting  (4 views, complex geometry)
# Machine fit: UNIT-2 (225kV — aluminium doesn't need high kV)
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg003():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RT PLAN — ALUMINUM AEROSPACE INVESTMENT CASTING (4 VIEWS)',
                 fontsize=11, fontweight='bold', color=NAVY, pad=10)

    # ── PART ISOMETRIC ───────────────────────────────────────────────────────
    ax.text(5, 12.5, 'ISOMETRIC — BRACKET ASSEMBLY', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Base flange
    base = mpatches.FancyBboxPatch((1.0, 4.5), 7.0, 1.2,
                                    boxstyle='round,pad=0.15', ec=NAVY,
                                    fc='#C8D8EC', lw=2)
    ax.add_patch(base)
    # Vertical web
    web = mpatches.FancyBboxPatch((3.5, 5.7), 2.0, 4.5,
                                   boxstyle='round,pad=0.1', ec=NAVY,
                                   fc='#C8D8EC', lw=2)
    ax.add_patch(web)
    # Top flange
    top = mpatches.FancyBboxPatch((2.5, 10.2), 4.0, 0.9,
                                   boxstyle='round,pad=0.1', ec=NAVY,
                                   fc='#C8D8EC', lw=2)
    ax.add_patch(top)
    # Rib fillet (curved feature — complex for RT)
    theta_rib = np.linspace(np.pi, np.pi * 1.5, 40)
    xr = 3.5 + 0.8 * np.cos(theta_rib)
    yr = 5.7 + 0.8 * np.sin(theta_rib)
    ax.fill_between(xr, [5.7]*40, yr, color='#A8B8CC', alpha=0.7)
    ax.plot(xr, yr, color=NAVY, lw=1)

    # Bolt holes in base
    for bx in [1.8, 3.0, 6.0, 7.2]:
        ax.add_patch(plt.Circle((bx, 5.1), 0.18, ec=NAVY, fc='white', lw=1.5))

    # Shrinkage porosity indicator (typical casting defect zone)
    ax.add_patch(plt.Circle((4.5, 7.5), 0.35, ec=RED, fc='#FFDDDD',
                             lw=1.5, ls='--', zorder=4))
    ax.text(5.2, 7.5, 'ZONE OF INTEREST\n(SHRINKAGE RISK)', va='center',
            fontsize=6.5, color=RED)

    ax.text(4.5, 4.0, 'PART ENVELOPE: 320×180×55 mm   WEIGHT: 3.8 kg',
            ha='center', fontsize=7.5, color=NAVY)

    # ── 4 VIEW BOXES ─────────────────────────────────────────────────────────
    view_data = [
        ('VIEW 1\n0° (NORMAL)\nThrough flange', 10.0, 10.5, GREEN,
         'kV 80  mA 5.0\nFFD 762mm 5×7"'),
        ('VIEW 2\n15° oblique\nWeb + fillet', 14.5, 10.5, '#8B1A8B',
         'kV 90  mA 5.0\nFFD 762mm 4×10"'),
        ('VIEW 3\n45° compound\nBolt-hole region', 10.0, 7.5, RED,
         'kV 75  mA 4.5\nFFD 812mm 5×7"'),
        ('VIEW 4\n30° tangential\nTop flange', 14.5, 7.5, '#0A6A3A',
         'kV 85  mA 5.0\nFFD 762mm 4×5"'),
    ]
    for label, vx, vy, vc, params in view_data:
        # Part outline thumbnail
        ax.add_patch(mpatches.FancyBboxPatch((vx - 1.8, vy - 1.0), 3.6, 2.5,
                      boxstyle='round,pad=0.1', ec=vc, fc='#F8F9FA', lw=1.5))
        # Simplified top/side thumbnail
        ax.add_patch(mpatches.Rectangle((vx - 1.3, vy - 0.3), 2.6, 0.4,
                      ec=NAVY, fc='#C8D8EC', lw=1))
        ax.add_patch(mpatches.Rectangle((vx - 0.4, vy + 0.1), 0.8, 1.2,
                      ec=NAVY, fc='#C8D8EC', lw=1))
        # Source
        ax.add_patch(plt.Circle((vx, vy + 1.65), 0.18, ec=vc, fc='#FFCCCC',
                                 lw=2, zorder=5))
        ax.text(vx, vy + 1.65, 'S', ha='center', va='center',
                fontsize=6, fontweight='bold', color=vc)
        arrow(ax, vx, vy + 1.47, vx, vy + 0.8, color=vc, lw=1.5, head=0.12)
        ax.text(vx, vy + 2.15, label, ha='center', va='bottom',
                fontsize=7.5, fontweight='bold', color=vc)
        ax.text(vx, vy - 0.75, params, ha='center', va='top',
                fontsize=6.5, color='black')

    note_box(ax, 9.5, 5.8, [
        'NOTES:',
        '1. Per MIL-STD-453C, Class R-1 acceptance criteria',
        '2. Min density 1.8 on all films; max 4.0',
        '3. 2T wire penetrameter (ASTM E747)',
        '4. Machine: UNIT-2 (Comet MXR225/22) — Al max 80mm',
        '5. No intermediate stops — complete all 4 views same session',
        f'6. Drawing approval: {APPROVER_NAME}  {APPROVER_PHONE}',
        '7. EAR ECCN 9A610 — Export control applies',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-003-F', rev='A',
                     title='Aluminum Aerospace Investment Casting\n4-View RT Plan — Bracket Assembly',
                     part_no='BKTR-AL7075-RT-003',
                     material='Al 7075-T6 Investment Casting',
                     scale='1:5', sheet='1 of 3', date='2024-12-02')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-004  Inconel 718 turbine disk segment  (6 slices, high kV, COMPLEX)
# Machine fit: UNIT-1 or UNIT-4 (Walk-In or Varex NDI 320/26, 320kV required)
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg004():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RT PLAN — INCONEL 718 TURBINE DISK SEGMENT  (6 SLICES / HIGH kV)',
                 fontsize=11, fontweight='bold', color=NAVY, pad=10)

    # ── FRONT VIEW — turbine disk half-section ───────────────────────────────
    ax.text(4.5, 12.5, 'FRONT VIEW — DISK HALF (SYMMETRICAL)',
            ha='center', fontsize=9, fontweight='bold', color=MUTED)

    # Disk body (sector)
    theta_outer = np.linspace(np.radians(0), np.radians(180), 120)
    theta_inner = np.linspace(np.radians(180), np.radians(0), 60)
    r_out = 4.0; r_in = 1.5
    cx_d, cy_d = 4.5, 4.0

    x_disk = list(r_out * np.cos(theta_outer) + cx_d) + \
              list(r_in  * np.cos(theta_inner) + cx_d)
    y_disk = list(r_out * np.sin(theta_outer) + cy_d) + \
              list(r_in  * np.sin(theta_inner) + cy_d)
    ax.fill(x_disk, y_disk, color='#B0B8C8', alpha=0.85, zorder=2)
    ax.plot(x_disk + [x_disk[0]], y_disk + [y_disk[0]], color=NAVY, lw=2)

    # Web thinning section
    web_theta = np.linspace(np.radians(40), np.radians(140), 40)
    r_web = 2.8
    x_web = r_web * np.cos(web_theta) + cx_d
    y_web = r_web * np.sin(web_theta) + cy_d
    ax.plot(x_web, y_web, color=AMBER, lw=1.5, ls='--', alpha=0.8)
    ax.text(cx_d, cy_d + r_web + 0.2, 'WEB THINNING ZONE\nMin t=18mm',
            ha='center', fontsize=6.5, color=AMBER)

    # Blade root slots (fir-tree)
    for ang in range(0, 180, 30):
        rad = np.radians(ang)
        bx = (r_out + 0.05) * np.cos(rad) + cx_d
        by = (r_out + 0.05) * np.sin(rad) + cy_d
        # Blade root slot mark (simple rectangle, no angle param)
        ax.add_patch(mpatches.Rectangle((bx - 0.08, by - 0.3), 0.16, 0.6,
                      ec='black', fc='#707888', lw=1, zorder=4))

    # Bore
    ax.add_patch(plt.Circle((cx_d, cy_d), r_in, ec=NAVY, fc='white', lw=1.5, zorder=5))
    ax.text(cx_d, cy_d, f'BORE\nØ150mm', ha='center', va='center',
            fontsize=6.5, color=NAVY)

    # OD dimension
    dim_line(ax, cx_d - r_out, cy_d - 0.5, cx_d + r_out, cy_d - 0.5,
             'OD = 800mm', offset=-0.35)
    ax.text(cx_d + r_out + 0.3, cy_d + 1.5, 'MATERIAL THICKNESS:\n45mm (rim)\n18mm (web)\n55mm (hub)',
            fontsize=7, va='top', color=NAVY)

    # ── SLICE POSITIONS ──────────────────────────────────────────────────────
    slice_angles = [0, 30, 60, 90, 120, 150]
    slice_colors = [RED, '#8B1A8B', '#0A6A3A', AMBER, BLUE, '#6B3A00']
    for i, (sang, scolor) in enumerate(zip(slice_angles, slice_colors)):
        rad = np.radians(sang)
        # Slice line through disk
        x0 = (r_in + 0.2) * np.cos(rad) + cx_d
        y0 = (r_in + 0.2) * np.sin(rad) + cy_d
        x1 = (r_out - 0.2) * np.cos(rad) + cx_d
        y1 = (r_out - 0.2) * np.sin(rad) + cy_d
        ax.plot([x0, x1], [y0, y1], color=scolor, lw=2, ls='--', zorder=6)
        # Label outside disk
        xl = (r_out + 0.4) * np.cos(rad) + cx_d
        yl = (r_out + 0.4) * np.sin(rad) + cy_d
        ax.text(xl, yl, f'S{i+1}', ha='center', va='center',
                fontsize=8, fontweight='bold', color=scolor,
                bbox=dict(boxstyle='circle,pad=0.2', fc='white', ec=scolor, lw=1.5))

    # ── SLICE SCHEDULE TABLE ─────────────────────────────────────────────────
    ax.text(14, 12.5, '6-SLICE EXPOSURE SCHEDULE', ha='center',
            fontsize=9, fontweight='bold', color=NAVY)
    headers2 = ['SL', 'ANGLE', 'T(mm)', 'kV', 'mA', 'FFD(mm)', 'FILM', 'Ug(mm)', 't(min)']
    col_x2   = [9.3, 10.1, 11.0, 11.8, 12.6, 13.4, 14.4, 15.6, 16.6]
    for h, x in zip(headers2, col_x2):
        ax.text(x, 12.1, h, ha='center', fontsize=6, fontweight='bold',
                color=WHITE,
                bbox=dict(boxstyle='square,pad=0.12', fc=NAVY, ec=NAVY))

    slices = [
        ('S1', '0°',   '45', '280', '5.0', '1016', '5×12 D5', '0.38', '14'),
        ('S2', '30°',  '48', '290', '5.0', '1016', '5×12 D5', '0.40', '16'),
        ('S3', '60°',  '52', '300', '5.5', '1066', '5×12 D5', '0.42', '18'),
        ('S4', '90°',  '55', '310', '5.5', '1066', '5×12 D5', '0.44', '18'),
        ('S5', '120°', '48', '290', '5.0', '1016', '5×12 D5', '0.40', '16'),
        ('S6', '150°', '45', '280', '5.0', '1016', '5×12 D5', '0.38', '14'),
    ]
    for ri, (row, scolor) in enumerate(zip(slices, slice_colors)):
        ry = 11.4 - ri * 0.7
        bg = LIGHT if ri % 2 == 0 else 'white'
        ax.add_patch(mpatches.FancyBboxPatch((9.0, ry - 0.18), 8.3, 0.55,
                      boxstyle='square,pad=0', fc=bg, ec='none', zorder=1))
        ax.add_patch(mpatches.FancyBboxPatch((9.0, ry - 0.18), 0.5, 0.55,
                      boxstyle='square,pad=0', fc=scolor, ec='none',
                      alpha=0.3, zorder=1))
        for val, x in zip(row, col_x2):
            ax.text(x, ry + 0.06, val, ha='center', fontsize=7, color='black', zorder=2)

    # Total shot time
    ax.text(14, 7.1, '★ TOTAL ESTIMATED SHOT TIME: 96 min (excl. setup)',
            ha='center', fontsize=8, fontweight='bold', color=NAVY,
            bbox=dict(boxstyle='round,pad=0.3', fc='#FFF8E1', ec=AMBER, lw=1.5))

    note_box(ax, 9.0, 6.5, [
        'NOTES:',
        '1. ASTM E1742 / ASTM E94 acceptance criteria',
        '2. Min 320kV required — UNIT-1 (Walk-In) or UNIT-4',
        '3. Inconel density 8.19 g/cm³ → use 2.5×T(mm) kV rule',
        '4. Geometric Ug = FS × (ODD/SOD); FS=0.4mm small focal spot',
        '5. Dosimetry required — HIGH RADIATION AREA',
        '6. Part weight: 42 kg — handling equipment required',
        f'7. Export control: ITAR — contact {APPROVER_EMAIL}',
        f'8. NDT Engineer: {ENGINEER_NAME}  Phone: {ENGINEER_PHONE}',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-004-A', rev='A',
                     title='Inconel 718 Turbine Disk Segment\n6-Slice RT Plan — High kV Complex Geometry',
                     part_no='TRB-IN718-DISK-004',
                     material='Inconel 718 (AMS 5664)',
                     scale='1:8', sheet='1 of 4', date='2024-12-10')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-005  SS304 pressure vessel nozzle-to-shell weld  (tangential + straight)
# Machine fit: UNIT-3 (Comet MXR320/26)
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg005():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RT PLAN — SS304 PRESSURE VESSEL NOZZLE-TO-SHELL WELD (3 SHOTS)',
                 fontsize=11, fontweight='bold', color=NAVY, pad=10)

    # ── VESSEL CROSS SECTION ─────────────────────────────────────────────────
    ax.text(5.5, 12.5, 'VESSEL CROSS SECTION — NOZZLE REGION',
            ha='center', fontsize=9, fontweight='bold', color=MUTED)

    # Vessel shell (horizontal cylinder cross-section — ellipse)
    vessel = mpatches.Ellipse((5.5, 6.5), 9.0, 7.0, ec=NAVY, fc='#D0D8E4',
                               lw=2.5, zorder=2)
    inner  = mpatches.Ellipse((5.5, 6.5), 8.0, 6.2, ec=NAVY, fc='white',
                               lw=1.5, zorder=3)
    ax.add_patch(vessel); ax.add_patch(inner)

    # Shell thickness callout
    ax.annotate('', xy=(9.5, 6.5), xytext=(10.0, 6.5),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=1))
    ax.text(10.2, 6.5, 't=16mm\nshell', va='center', fontsize=6.5, color=NAVY)

    # Nozzle (vertical breakout)
    nozzle_outer = mpatches.FancyBboxPatch((4.3, 9.85), 2.4, 2.5,
                    boxstyle='square,pad=0', ec=NAVY, fc='#D0D8E4', lw=2, zorder=4)
    nozzle_inner = mpatches.FancyBboxPatch((4.7, 9.85), 1.6, 2.5,
                    boxstyle='square,pad=0', ec=NAVY, fc='white', lw=1.5, zorder=5)
    ax.add_patch(nozzle_outer); ax.add_patch(nozzle_inner)

    # Nozzle thickness
    ax.annotate('', xy=(4.3, 11.5), xytext=(4.7, 11.5),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(3.8, 11.5, 't=20mm\nnozzle', va='center', ha='right',
            fontsize=6.5, color=NAVY)

    # Weld seam (amber)
    ax.add_patch(mpatches.Wedge((5.5, 10.0), 0.5, 60, 120,
                  ec=AMBER, fc='#FFE0A0', lw=2, zorder=6))
    ax.text(5.5, 10.7, 'WELD', ha='center', fontsize=7,
            fontweight='bold', color=AMBER)

    # Reinforcement pad
    ax.add_patch(mpatches.FancyBboxPatch((3.7, 9.7), 3.6, 0.25,
                  boxstyle='round,pad=0.05', ec=BLUE, fc='#DDEEFF',
                  lw=1.5, ls='--', zorder=5))
    ax.text(5.5, 9.55, 'REINFORCEMENT PAD  t=12mm', ha='center',
            fontsize=6.5, color=BLUE)

    # OD labels
    ax.text(1.0, 6.5, 'Vessel OD\n600mm', ha='center', va='center',
            fontsize=7, color=NAVY)
    ax.text(5.5, 12.8, 'Nozzle OD: 150mm (4" NPS SCH XS)',
            ha='center', fontsize=7.5, color=NAVY)

    # ── 3 SHOT POSITIONS ─────────────────────────────────────────────────────
    ax.text(14, 12.5, 'SHOT GEOMETRY DETAIL', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    shot_info = [
        ('SHOT 1\nNORMAL / STRAIGHT\nThrough nozzle wall',
         12.5, 10.0, RED,   'kV 160  mA 5.0\nFFD 762mm  4×10 D5\nIQI wire film-side'),
        ('SHOT 2\nTANGENTIAL\nAlong shell curve',
         16.0, 10.0, GREEN, 'kV 200  mA 5.5\nFFD 812mm  7×17 D5\nIQI wire source-side'),
        ('SHOT 3\n30° OBLIQUE\nWeld toe to pad',
         14.0, 6.5, BLUE,  'kV 180  mA 5.0\nFFD 762mm  4×10 D5\nIQI wire source-side'),
    ]
    for label, sx, sy, sc, params in shot_info:
        ax.add_patch(plt.Circle((sx, sy), 0.28, ec=sc, fc='#FFCCCC',
                                 lw=2, zorder=5))
        ax.text(sx, sy, 'S', ha='center', va='center',
                fontsize=8, fontweight='bold', color=sc)
        ax.text(sx, sy + 1.6, label, ha='center', va='bottom',
                fontsize=7.5, fontweight='bold', color=sc)
        ax.text(sx, sy - 0.6, params, ha='center', va='top',
                fontsize=6.5, color='black',
                bbox=dict(boxstyle='round,pad=0.25', fc='#F8F9FA', ec=sc, lw=0.8))

    note_box(ax, 9.5, 4.5, [
        'NOTES:',
        '1. ASME Sec VIII Div 1 + Sec V Art. 2',
        '2. 100% RT of nozzle-to-shell weld (full circumference)',
        '3. Pre-heat to 100°C; cool before RT (avoid thermal distortion)',
        '4. Machine: UNIT-3 (Comet MXR320/26)',
        '5. Film density: 2.0 – 3.5 ASTM E94 density range',
        f'6. Radiographic Technician: {ENGINEER_NAME}',
        f'7. Contact: {ENGINEER_EMAIL}  {ENGINEER_PHONE}',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-005-B', rev='B',
                     title='SS304 Pressure Vessel Nozzle-to-Shell\nRT Plan — 3 Shot Positions',
                     part_no='PV-SS304-NOZ-005',
                     material='SS 304L (ASTM A240)',
                     scale='1:10', sheet='1 of 2', date='2025-01-08')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# DWG-006  OVERSIZE — Large aerospace fuselage panel  (EDGE CASE)
# Dimensions: 2400mm × 1800mm × 6mm  →  EXCEEDS ALL MACHINE ENVELOPES
# ═══════════════════════════════════════════════════════════════════════════════

def draw_dwg006():
    fig = new_fig()
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RT PLAN — AEROSPACE FUSELAGE PANEL  ⚠ OVERSIZE — EXCEEDS ALL MACHINE ENVELOPES',
                 fontsize=10, fontweight='bold', color=RED, pad=10)

    # Red warning banner
    ax.add_patch(mpatches.FancyBboxPatch((0.5, 11.5), 19.0, 0.9,
                  boxstyle='round,pad=0.1', ec=RED, fc='#FFDDDD', lw=2))
    ax.text(10, 11.95, '⚠  CAUTION: PART DIMENSIONS (2400 × 1800 mm) EXCEED ALL CABINET AND WALK-IN '
                       'MACHINE ENVELOPES  ⚠',
            ha='center', va='center', fontsize=9, fontweight='bold', color=RED)

    # ── PANEL PLAN VIEW ──────────────────────────────────────────────────────
    ax.text(7.5, 11.2, 'PLAN VIEW — FULL PANEL', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Panel outline (scaled: 1mm = 0.004 figcoord → 2400×1800 = 9.6 × 7.2)
    panel = mpatches.FancyBboxPatch((2.0, 2.5), 9.6, 7.2,
                                     boxstyle='square,pad=0.0', ec=NAVY,
                                     fc='#E0E8F0', lw=2.5)
    ax.add_patch(panel)
    ax.text(6.8, 6.1, 'Al 2024-T3 FUSELAGE SKIN PANEL\n2400mm × 1800mm × 6.0mm\n~70 kg',
            ha='center', va='center', fontsize=9, fontweight='bold', color=NAVY)

    # Stringers (horizontal)
    for sy in [3.7, 5.1, 6.5, 7.9]:
        ax.plot([2.0, 11.6], [sy, sy], color=BLUE, lw=1.2, ls='--', alpha=0.7)
    ax.text(11.8, 6.5, 'STRINGER\nLOCATIONS\n(typical 350mm pitch)',
            va='center', fontsize=7, color=BLUE)

    # Lap joint welds (4 vertical)
    for wx in [4.4, 6.4, 8.0, 9.6]:
        ax.plot([wx, wx], [2.5, 9.7], color=AMBER, lw=1.8, ls=':', alpha=0.8)
    ax.text(3.0, 2.0, 'LAP JOINTS (AMBER)\nRT per MIL-STD-1907', fontsize=7,
            color=AMBER, ha='center')

    # Rivet holes array
    for rxi in range(4):
        for ryi in range(6):
            rx = 2.8 + rxi * 2.2
            ry = 3.0 + ryi * 1.1
            ax.add_patch(plt.Circle((rx, ry), 0.07, ec=MUTED, fc='white', lw=0.8, alpha=0.6))

    # Dimension lines
    dim_line(ax, 2.0, 2.1, 11.6, 2.1, '2400 mm', offset=-0.2)
    dim_line(ax, 1.6, 2.5, 1.6, 9.7, '1800 mm', offset=-0.4)

    # ── MACHINE COMPARISON TABLE ─────────────────────────────────────────────
    ax.text(15.5, 11.2, 'MACHINE ENVELOPE vs PART SIZE', ha='center',
            fontsize=9, fontweight='bold', color=NAVY)

    headers = ['MACHINE', 'MAX L (mm)', 'MAX W (mm)', 'FIT?']
    col_x   = [13.2, 15.0, 16.8, 18.2]
    for h, x in zip(headers, col_x):
        ax.text(x, 10.8, h, ha='center', fontsize=7, fontweight='bold',
                color=WHITE,
                bbox=dict(boxstyle='square,pad=0.15', fc=NAVY, ec=NAVY))

    mach_rows = [
        ('UNIT-2  Comet MXR225',  '600', '600',  '✗ NO'),
        ('UNIT-3  Comet MXR320',  '600', '600',  '✗ NO'),
        ('UNIT-1  Varian Walk-In', '1526','1200', '✗ NO'),
        ('UNIT-4  Varex NDI320',   '1526','1200', '✗ NO'),
        ('REQUIRED',               '2400','1800', '——'),
    ]
    for ri, (name, ml, mw, fit) in enumerate(mach_rows):
        ry = 10.2 - ri * 0.7
        fc = '#FFDDDD' if '✗' in fit else ('#DDEEFF' if '——' in fit else '#DDFFD8')
        ax.add_patch(mpatches.FancyBboxPatch((12.3, ry - 0.18), 6.6, 0.55,
                      boxstyle='square,pad=0', fc=fc, ec='none', zorder=1))
        for val, x in zip([name, ml, mw, fit], col_x):
            color = RED if '✗' in val else (NAVY if '——' in val else 'black')
            ax.text(x, ry + 0.06, val, ha='center', fontsize=7,
                    fontweight='bold' if '✗' in val or '——' in val else 'normal',
                    color=color, zorder=2)

    # Recommendation box
    ax.add_patch(mpatches.FancyBboxPatch((12.3, 5.8), 7.0, 1.4,
                  boxstyle='round,pad=0.2', ec=RED, fc='#FFDDDD', lw=2))
    ax.text(15.8, 7.0, 'DISPOSITION REQUIRED', ha='center',
            fontsize=8.5, fontweight='bold', color=RED)
    ax.text(15.8, 6.5,
            '1. Outsource to OEM crawler-track system (>3000mm)\n'
            '2. Section panel for cabinet RT (design change)\n'
            '3. Request ROTO-XRAY ROBOT approval (PER SE-999)',
            ha='center', va='top', fontsize=7, color=RED)

    note_box(ax, 12.3, 5.5, [
        'NOTES:',
        '1. Part too large for ANY on-site machine',
        '2. Per ASME RT — panel segmentation NOT permitted',
        '3. Outsource vendor must be NADCAP-certified',
        '4. Report to NDT Supervisor before proceeding',
        f'5. Approver: {APPROVER_NAME}',
        f'6. Email: {APPROVER_EMAIL}  Ph: {APPROVER_PHONE}',
        '7. Drawing ITAR-controlled — DISTRIBUTION D LIMITED',
    ])

    draw_title_block(fig,
                     dwg_no='APC-RT-006-E', rev='A',
                     title='Aerospace Fuselage Skin Panel\nRT Plan — ⚠ OVERSIZE PART',
                     part_no='FUS-AL2024-2400X1800',
                     material='Al 2024-T3 Clad (AMS-QQ-A-250/5)',
                     scale='1:40', sheet='1 of 1', date='2025-01-15')
    return fig


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

DRAWINGS = [
    ('RT-DWG-001-FLAT-PLATE-WELD.pdf',         draw_dwg001),
    ('RT-DWG-002-PIPE-ELBOW-3-SHOTS.pdf',      draw_dwg002),
    ('RT-DWG-003-AERO-BRACKET-4-VIEWS.pdf',    draw_dwg003),
    ('RT-DWG-004-TURBINE-DISK-6-SLICES.pdf',   draw_dwg004),
    ('RT-DWG-005-NOZZLE-WELD-3-SHOTS.pdf',     draw_dwg005),
    ('RT-DWG-006-FUSELAGE-OVERSIZE-EDGE.pdf',  draw_dwg006),
]

if __name__ == '__main__':
    print(f'Generating {len(DRAWINGS)} RT diagrams -> {OUT_DIR}')
    for fname, fn in DRAWINGS:
        path = os.path.join(OUT_DIR, fname)
        fig = fn()
        fig.savefig(path, format='pdf', bbox_inches='tight', dpi=150)
        plt.close(fig)
        print(f'  OK  {fname}')
    print('Done.')
