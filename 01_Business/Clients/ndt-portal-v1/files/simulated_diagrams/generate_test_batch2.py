"""
Generate 4 additional clean RT test diagrams — no PII, no ITAR/EAR keywords.
Each uses a different geometry for pipeline testing diversity.

Outputs:
  RT-TEST-CLEAN-PRESSURE-VESSEL-SHELL.pdf   — curved shell weld, 2-shot panoramic
  RT-TEST-CLEAN-T-JOINT-WELD.pdf            — structural T-joint fillet, 4 shots
  RT-TEST-CLEAN-SOCKET-WELD-SMALL-BORE.pdf  — 1" NPS socket weld, 2 shots
  RT-TEST-CLEAN-FLAT-PLATE-BUTT.pdf         — flat plate double-V butt, 5 shots
"""
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Arc, FancyArrowPatch

BASE = os.path.dirname(os.path.abspath(__file__))

NAVY  = '#1A2E4A'
BLUE  = '#1F5C99'
AMBER = '#D97B06'
GREEN = '#1A7A3C'
MUTED = '#6B7280'
RED   = '#C0392B'
LIGHT = '#EBF3FB'


# ── Helpers ───────────────────────────────────────────────────────────────────

def title_block(fig, dwg_num, part_desc, weld_desc, std, material, rev='A', date='2025-03-15'):
    tb = fig.add_axes([0.01, 0.01, 0.98, 0.16], frameon=True)
    tb.set_xlim(0, 100); tb.set_ylim(0, 100)
    tb.set_xticks([]); tb.set_yticks([])
    for sp in tb.spines.values():
        sp.set_linewidth(1.5); sp.set_color(NAVY)
    tb.patch.set_facecolor('#F0F4F8')

    tb.text(20, 88, 'NDT INSPECTION SERVICES', ha='center', fontsize=9, fontweight='bold', color=NAVY)
    tb.text(20, 74, part_desc,  ha='center', fontsize=8, color='black')
    tb.text(20, 60, weld_desc,  ha='center', fontsize=8, color='black')
    tb.text(20, 46, f'ACCEPTANCE STD: {std}', ha='center', fontsize=8, fontweight='bold', color=NAVY)
    tb.text(20, 32, f'Date: {date}    Rev: {rev}', ha='center', fontsize=7.5, color=MUTED)

    tb.text(57.5, 86, 'DRAWING NUMBER', ha='center', fontsize=8, fontweight='bold', color=NAVY)
    tb.text(57.5, 70, dwg_num, ha='center', fontsize=11, fontweight='bold', color=NAVY)
    tb.text(57.5, 50, f'MATERIAL: {material}', ha='center', fontsize=8, color='black')
    tb.text(57.5, 34, 'SCALE: 1:5   SHEET: 1 of 1', ha='center', fontsize=7.5, color=MUTED)

    tb.text(82, 86, 'NDT STANDARD', ha='center', fontsize=8, fontweight='bold', color=NAVY)
    tb.text(82, 70, 'ASME Sec V Art. 2', ha='center', fontsize=9, color='black')
    tb.text(82, 54, 'ASTM E94', ha='center', fontsize=9, color='black')
    tb.text(82, 34, 'DISTRIBUTION: UNRESTRICTED', ha='center', fontsize=7.5, color=GREEN)


def table(ax, title_x, title_y, headers, rows, col_x):
    ax.text(title_x, title_y + 0.5, 'EXPOSURE SCHEDULE', ha='center',
            fontsize=9, fontweight='bold', color=NAVY)
    for h, x in zip(headers, col_x):
        ax.text(x, title_y, h, ha='center', fontsize=6.5, fontweight='bold', color='white',
                bbox=dict(boxstyle='square,pad=0.15', fc=NAVY, ec=NAVY))
    for ri, row in enumerate(rows):
        ry = title_y - 0.6 - ri * 0.7
        bg = LIGHT if ri % 2 == 0 else 'white'
        ax.add_patch(mpatches.FancyBboxPatch((col_x[0] - 0.6, ry - 0.18), col_x[-1] - col_x[0] + 1.2, 0.55,
                      boxstyle='square,pad=0', fc=bg, ec='none', zorder=1))
        for val, x in zip(row, col_x):
            ax.text(x, ry + 0.06, val, ha='center', fontsize=7, color='black', zorder=2)


# ══════════════════════════════════════════════════════════════════════════════
# 1. PRESSURE VESSEL SHELL WELD — 2-shot panoramic
# ══════════════════════════════════════════════════════════════════════════════

def gen_pressure_vessel():
    out = os.path.join(BASE, 'RT-TEST-CLEAN-PRESSURE-VESSEL-SHELL.pdf')
    fig = plt.figure(figsize=(17, 11), facecolor='white')
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — PRESSURE VESSEL SHELL LONGITUDINAL SEAM WELD (18" OD × 0.375" WT)',
                 fontsize=10, fontweight='bold', color=NAVY, pad=10)

    # ── Cross section (curved shell) ──────────────────────────────────────────
    ax.text(5.0, 12.5, 'SHELL WELD CROSS-SECTION (DOUBLE-V)', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Outer arc (shell)
    shell_arc_o = Arc((5.0, 6.5), 6.5, 6.5, angle=0, theta1=60, theta2=120,
                       color=NAVY, lw=2.5)
    shell_arc_i = Arc((5.0, 6.5), 5.5, 5.5, angle=0, theta1=60, theta2=120,
                       color=NAVY, lw=1.5)
    ax.add_patch(shell_arc_o)
    ax.add_patch(shell_arc_i)
    # Fill between arcs via polygon approximation
    thetas = np.linspace(np.radians(60), np.radians(120), 40)
    ox = 5.0 + 3.25 * np.cos(thetas); oy = 6.5 + 3.25 * np.sin(thetas)
    ix = 5.0 + 2.75 * np.cos(thetas); iy = 6.5 + 2.75 * np.sin(thetas)
    xs = np.concatenate([ox, ix[::-1]]); ys = np.concatenate([oy, iy[::-1]])
    ax.fill(xs, ys, color='#C8D8EC', alpha=0.7, zorder=2)

    # Weld bead at top center of arc (90 deg)
    wx = 5.0; wy_base = 6.5 + 3.25  # top of outer
    ax.add_patch(mpatches.Ellipse((wx, wy_base + 0.12), 0.6, 0.25,
                  ec=AMBER, fc='#FFE0A0', lw=2, zorder=4))
    ax.text(wx, wy_base + 0.55, 'WELD\nCROWN', ha='center', fontsize=7.5,
            fontweight='bold', color=AMBER)

    # Source position — panoramic inside
    ax.add_patch(plt.Circle((wx, 6.5), 0.3, ec=RED, fc='#FFCCCC', lw=2, zorder=5))
    ax.text(wx, 6.5, 'S', ha='center', va='center', fontsize=9, fontweight='bold', color=RED)
    ax.annotate('Panoramic\nSource (inside)', xy=(wx + 0.35, 6.5), fontsize=7.5,
                color=RED, va='center')
    # Rays outward
    for ang in [75, 90, 105]:
        rad = np.radians(ang)
        ax.annotate('', xy=(5 + 2.7 * np.cos(rad), 6.5 + 2.7 * np.sin(rad)),
                    xytext=(5 + 0.35 * np.cos(rad), 6.5 + 0.35 * np.sin(rad)),
                    arrowprops=dict(arrowstyle='-|>', color=RED, lw=1.3, mutation_scale=10))

    # Dimensions
    ax.annotate('', xy=(5, 6.5 + 2.75), xytext=(5, 6.5 + 3.25),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(5.7, 6.5 + 3.0, 'WT\n9.5mm', fontsize=7, color=NAVY)
    ax.annotate('', xy=(2, 9.8), xytext=(8, 9.8),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(5, 10.15, 'OD = 457mm', ha='center', fontsize=7.5, color=NAVY)

    # Film strip on outside
    ax.plot([2.0, 8.0], [6.5 + 3.35, 6.5 + 3.35], color=GREEN, lw=2.5, ls='--')
    ax.text(5, 6.5 + 3.6, 'FILM: 5×12"  CLASS D5  (FILM SIDE — OUTER SURFACE)',
            ha='center', fontsize=7.5, color=GREEN, fontweight='bold')

    # ── Shot layout (end-on view) ─────────────────────────────────────────────
    ax.text(14.0, 12.5, 'SHOT GEOMETRY (END-ON VIEW)', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)
    cx, cy = 14.0, 9.0
    ax.add_patch(plt.Circle((cx, cy), 2.8, ec=NAVY, fc='#C8D8EC', lw=2))
    ax.add_patch(plt.Circle((cx, cy), 2.2, ec=NAVY, fc='white', lw=1.5))
    ax.text(cx, cy, '18" OD\n457mm\nWT 9.5mm', ha='center', va='center',
            fontsize=7, color=NAVY)
    # Source at center
    ax.add_patch(plt.Circle((cx, cy), 0.22, ec=RED, fc='#FFCCCC', lw=2, zorder=5))
    ax.text(cx, cy, 'S', ha='center', va='center', fontsize=7, fontweight='bold', color=RED)

    # 2 film strips on 2 halves
    colors_shot = [RED, '#8B1A8B']
    labels_shot = ['SHOT 1\n0°–180°', 'SHOT 2\n180°–360°']
    for i, (col, lbl) in enumerate(zip(colors_shot, labels_shot)):
        ang = i * 180 + 90
        rad = np.radians(ang)
        fx = cx + 3.4 * np.cos(rad); fy = cy + 3.4 * np.sin(rad)
        ax.plot([cx + 2.85 * np.cos(rad), cx + 3.35 * np.cos(rad)],
                [cy + 2.85 * np.sin(rad), cy + 3.35 * np.sin(rad)],
                color=col, lw=3)
        ax.text(cx + 4.4 * np.cos(rad), cy + 4.4 * np.sin(rad),
                lbl, ha='center', va='center', fontsize=7.5, color=col, fontweight='bold')

    # ── Exposure table ────────────────────────────────────────────────────────
    hdrs = ['SHOT', 'TECHNIQUE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'COVERAGE', 'TIME(min)']
    rows_ = [
        ['1', 'PANORAMIC', '200', '5.0', '457', '5×12 D5', '180°', '12'],
        ['2', 'PANORAMIC', '200', '5.0', '457', '5×12 D5', '180°', '12'],
    ]
    col_x = [9.5, 10.8, 12.0, 12.8, 13.8, 15.1, 16.2, 17.4]
    table(ax, 13.5, 6.2, hdrs, rows_, col_x)

    # ── Notes ─────────────────────────────────────────────────────────────────
    ax.text(0.5, 5.5, '\n'.join([
        'NOTES:',
        '1. Per ASME Sec VIII Div.1 — full-length RT on long. seam welds',
        '2. Material: SA-516 Gr.70 Carbon Steel plate',
        '3. Film density: 2.0 – 3.5 per ASTM E94',
        '4. IQI: ASTM E747 wire set, sensitivity 2T',
        '5. Panoramic single-wall single-image (SWSI)',
        '6. Geometric Ug ≤ 0.76mm; source size ≤ 3mm',
    ]), va='top', fontsize=7.5, color=NAVY,
    bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))

    title_block(fig, 'RT-TEST-PV-SHELL-001',
                '18" OD × 0.375" WT Pressure Vessel Shell',
                'Longitudinal Seam Weld RT Plan — 2-Shot Panoramic',
                'ASME Sec VIII Div.1', 'SA-516 Gr.70')
    fig.savefig(out, format='pdf', bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f'Saved: {out}')


# ══════════════════════════════════════════════════════════════════════════════
# 2. STRUCTURAL T-JOINT FILLET WELD — 4-shot
# ══════════════════════════════════════════════════════════════════════════════

def gen_t_joint():
    out = os.path.join(BASE, 'RT-TEST-CLEAN-T-JOINT-WELD.pdf')
    fig = plt.figure(figsize=(17, 11), facecolor='white')
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — STRUCTURAL T-JOINT FILLET WELD  (PL 20mm × PL 16mm)',
                 fontsize=10, fontweight='bold', color=NAVY, pad=10)

    # ── T-joint cross-section ─────────────────────────────────────────────────
    ax.text(5.0, 12.5, 'T-JOINT CROSS-SECTION (FILLET BOTH SIDES)', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Base plate (horizontal)
    ax.add_patch(mpatches.FancyBboxPatch((1.5, 8.0), 7.0, 1.2,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.text(5.0, 8.6, 'BASE PLATE — 20mm', ha='center', fontsize=7.5, color=NAVY, fontweight='bold')

    # Web plate (vertical)
    ax.add_patch(mpatches.FancyBboxPatch((4.4, 9.2), 1.2, 2.5,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.text(5.0, 11.9, 'WEB — 16mm', ha='center', fontsize=7.5, color=NAVY, fontweight='bold')

    # Fillet welds (triangles)
    for xoff, label in [(-0.3, 'WELD L'), (0.3, 'WELD R')]:
        wx = 5.0 + xoff
        tri_x = [wx - 0.4, wx + 0.4, wx]
        tri_y = [9.2, 9.2, 8.8]
        ax.fill(tri_x, tri_y, color='#FFE0A0', alpha=0.9, ec=AMBER, lw=1.5, zorder=3)

    ax.text(5.0, 8.4, 'FILLET SIZE: 12mm (BOTH SIDES)', ha='center',
            fontsize=7, color=AMBER, fontweight='bold')

    # Source positions
    src_positions = [(3.0, 11.0, 30, 'S1'), (7.0, 11.0, 150, 'S2'),
                     (3.0, 8.4, 210, 'S3'), (7.0, 8.4, 330, 'S4')]
    colors_src = [RED, '#8B1A8B', GREEN, BLUE]
    for (sx, sy, _, sid), col in zip(src_positions, colors_src):
        ax.add_patch(plt.Circle((sx, sy), 0.25, ec=col, fc='#FFCCCC', lw=2, zorder=5))
        ax.text(sx, sy, sid, ha='center', va='center', fontsize=6.5,
                fontweight='bold', color=col)
        # Arrow toward weld
        ax.annotate('', xy=(5.0, 9.0), xytext=(sx, sy),
                    arrowprops=dict(arrowstyle='-|>', color=col, lw=1.2,
                                   mutation_scale=10))

    # Dimensions
    ax.annotate('', xy=(1.5, 7.6), xytext=(8.5, 7.6),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(5.0, 7.3, 'BASE WIDTH = 200mm', ha='center', fontsize=7.5, color=NAVY)

    # Film positions
    ax.plot([1.5, 8.5], [7.4, 7.4], color=GREEN, lw=2.5, ls='--')
    ax.text(5.0, 7.1, 'FILM: 4×10"  CLASS D5  (SHOT 3 & 4)', ha='center',
            fontsize=7.5, color=GREEN, fontweight='bold')

    # ── Side view ─────────────────────────────────────────────────────────────
    ax.text(14.0, 12.5, 'SIDE VIEW — SHOT LAYOUT', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)
    # Base plate
    ax.add_patch(mpatches.FancyBboxPatch((10.0, 8.8), 8.0, 1.0,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    # Web plate
    ax.add_patch(mpatches.FancyBboxPatch((13.6, 9.8), 0.8, 3.0,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    # Weld zones
    ax.plot([13.6, 10.0], [9.8, 9.8], color=AMBER, lw=2.5)
    ax.plot([14.4, 18.0], [9.8, 9.8], color=AMBER, lw=2.5)

    # Shot zones with hatching
    shot_colors_side = [RED, '#8B1A8B', GREEN, BLUE]
    shot_x = [11.0, 12.0, 15.0, 16.0]
    shot_labels_side = ['SH1\nL-TOP', 'SH2\nL-BOT', 'SH3\nR-TOP', 'SH4\nR-BOT']
    for sx, lbl, col in zip(shot_x, shot_labels_side, shot_colors_side):
        ax.add_patch(mpatches.FancyBboxPatch((sx - 0.3, 9.5), 0.6, 1.2,
                      boxstyle='round,pad=0.05', ec=col, fc=col, alpha=0.2, lw=1.5))
        ax.text(sx, 11.0, lbl, ha='center', fontsize=6.5, color=col, fontweight='bold')

    ax.annotate('', xy=(10.0, 8.5), xytext=(18.0, 8.5),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(14.0, 8.2, 'WELD LENGTH = 500mm (4 SHOTS × 125mm)', ha='center',
            fontsize=7.5, color=NAVY)

    # ── Exposure table ────────────────────────────────────────────────────────
    hdrs = ['SHOT', 'LOCATION', 'ANGLE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'TIME(min)']
    rows_ = [
        ['1', 'TOP-LEFT',    '45°', '100', '3.5', '600', '4×10 D5', '6'],
        ['2', 'BOT-LEFT',    '45°', '100', '3.5', '600', '4×10 D5', '6'],
        ['3', 'TOP-RIGHT',   '45°', '100', '3.5', '600', '4×10 D5', '6'],
        ['4', 'BOT-RIGHT',   '45°', '100', '3.5', '600', '4×10 D5', '6'],
    ]
    col_x = [9.5, 10.7, 11.8, 12.8, 13.6, 14.6, 15.8, 17.1]
    table(ax, 13.5, 6.8, hdrs, rows_, col_x)

    # ── Notes ─────────────────────────────────────────────────────────────────
    ax.text(0.5, 5.8, '\n'.join([
        'NOTES:',
        '1. Per AWS D1.1 Structural Welding Code — Steel',
        '2. Material: ASTM A36 Structural Steel plate',
        '3. Film density: 2.0 – 3.5 (ASTM E94)',
        '4. IQI: ASTM E747 wire penetrameter, 2T sensitivity',
        '5. Fillet weld RT per AWS D1.1 Annex K procedure',
        '6. Geometric Ug ≤ 0.51mm, focal spot 1.5mm',
    ]), va='top', fontsize=7.5, color=NAVY,
    bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))

    title_block(fig, 'RT-TEST-TJOINT-001',
                'A36 Steel T-Joint — PL 20mm × PL 16mm',
                'Fillet Weld RT Plan — 4-Shot',
                'AWS D1.1', 'ASTM A36')
    fig.savefig(out, format='pdf', bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f'Saved: {out}')


# ══════════════════════════════════════════════════════════════════════════════
# 3. SMALL-BORE SOCKET WELD — 1" NPS, 2-shot
# ══════════════════════════════════════════════════════════════════════════════

def gen_socket_weld():
    out = os.path.join(BASE, 'RT-TEST-CLEAN-SOCKET-WELD-SMALL-BORE.pdf')
    fig = plt.figure(figsize=(17, 11), facecolor='white')
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — SOCKET WELD FITTING  (1" NPS  SCH 80  STAINLESS)',
                 fontsize=10, fontweight='bold', color=NAVY, pad=10)

    # ── Longitudinal cross-section ────────────────────────────────────────────
    ax.text(5.0, 12.5, 'SOCKET WELD CROSS-SECTION (LONGITUDINAL)', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Socket fitting body (left)
    ax.add_patch(mpatches.FancyBboxPatch((1.0, 9.4), 3.5, 2.4,
                  boxstyle='round,pad=0.05', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.add_patch(mpatches.FancyBboxPatch((1.5, 9.9), 1.5, 1.4,  # socket bore
                  boxstyle='round,pad=0.0', ec='white', fc='white', lw=0))
    ax.text(2.0, 11.2, 'SOCKET\nFITTING', ha='center', fontsize=7, color=NAVY, fontweight='bold')

    # Pipe inserted into socket (right of bore)
    ax.add_patch(mpatches.FancyBboxPatch((3.0, 9.9), 4.0, 0.5,
                  boxstyle='round,pad=0.0', ec=NAVY, fc='#C8D8EC', lw=1.5))
    ax.add_patch(mpatches.FancyBboxPatch((3.0, 10.8), 4.0, 0.5,
                  boxstyle='round,pad=0.0', ec=NAVY, fc='#C8D8EC', lw=1.5))
    ax.text(5.5, 11.5, '1" SCH 80 PIPE', ha='center', fontsize=7, color=NAVY)

    # Fillet weld at socket opening
    tri_x = [4.4, 4.4, 4.8]
    tri_y = [9.9, 11.3, 11.3]
    ax.fill(tri_x, tri_y, color='#FFE0A0', ec=AMBER, lw=1.5, zorder=3)
    ax.text(4.1, 11.6, 'FILLET\nWELD', ha='center', fontsize=6.5,
            fontweight='bold', color=AMBER)

    # Dimensions
    ax.annotate('', xy=(1.0, 9.1), xytext=(4.5, 9.1),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(2.75, 8.85, 'SOCKET DEPTH = 28mm', ha='center', fontsize=7, color=NAVY)
    ax.annotate('', xy=(4.4, 9.6), xytext=(4.4, 11.55),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(3.6, 10.55, 'OD\n33.4mm', ha='center', fontsize=7, color=NAVY)

    # Source positions
    sx1, sy1 = 5.5, 12.5
    sx2, sy2 = 5.5, 8.4
    for sx, sy, sid, col in [(sx1, sy1, 'S1', RED), (sx2, sy2, 'S2', '#8B1A8B')]:
        ax.add_patch(plt.Circle((sx, sy), 0.25, ec=col, fc='#FFCCCC', lw=2, zorder=5))
        ax.text(sx, sy, sid, ha='center', va='center', fontsize=6.5,
                fontweight='bold', color=col)
        ax.annotate('', xy=(sx, 11.6 if sy > 11 else 9.5),
                    xytext=(sx, sy + (0.26 if sy < 11 else -0.26)),
                    arrowprops=dict(arrowstyle='-|>', color=col, lw=1.8, mutation_scale=12))

    # Film
    ax.plot([1.0, 8.0], [9.6, 9.6], color=GREEN, lw=2.5, ls='--')
    ax.text(4.5, 9.3, 'FILM: 1.5×6"  CLASS D5  (SHOT 2 — FILM SIDE)',
            ha='center', fontsize=7.5, color=GREEN, fontweight='bold')

    # ── End-on view ───────────────────────────────────────────────────────────
    ax.text(14.0, 12.5, 'END-ON CROSS-SECTION', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)
    cx, cy = 14.0, 10.0
    ax.add_patch(plt.Circle((cx, cy), 2.0, ec=NAVY, fc='#C8D8EC', lw=2))   # OD
    ax.add_patch(plt.Circle((cx, cy), 1.45, ec=NAVY, fc='white', lw=1.5))  # ID
    ax.text(cx, cy, '1" SCH80\nOD 33.4mm\nWT 4.55mm', ha='center', va='center',
            fontsize=6.5, color=NAVY)

    # Weld bead ring
    ax.add_patch(plt.Circle((cx, cy), 2.1, ec=AMBER, fc='none', lw=2.5, ls='--'))
    ax.text(cx + 2.3, cy + 0.5, 'FILLET\nWELD', fontsize=6.5, color=AMBER, fontweight='bold')

    # 2 film strips
    for ang, col, lbl in [(90, RED, 'S1 TOP'), (270, '#8B1A8B', 'S2 BOT')]:
        rad = np.radians(ang)
        ax.plot([cx + 2.15 * np.cos(rad), cx + 2.7 * np.cos(rad)],
                [cy + 2.15 * np.sin(rad), cy + 2.7 * np.sin(rad)],
                color=col, lw=3)
        ax.text(cx + 3.3 * np.cos(rad), cy + 3.3 * np.sin(rad),
                lbl, ha='center', va='center', fontsize=7.5, color=col, fontweight='bold')

    # SFD annotation
    ax.annotate('', xy=(cx, cy), xytext=(cx, cy + 3.5),
                arrowprops=dict(arrowstyle='<->', color=MUTED, lw=0.8))
    ax.text(cx + 0.5, cy + 1.75, 'SFD\n450mm', fontsize=7, color=MUTED)

    # ── Exposure table ────────────────────────────────────────────────────────
    hdrs = ['SHOT', 'TECHNIQUE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'COVERAGE', 'TIME(min)']
    rows_ = [
        ['1', 'SWSI — TOP', '80', '3.0', '450', '1.5×6 D5', '180°', '4'],
        ['2', 'SWSI — BOT', '80', '3.0', '450', '1.5×6 D5', '180°', '4'],
    ]
    col_x = [9.5, 10.9, 12.0, 12.8, 13.8, 14.8, 16.0, 17.2]
    table(ax, 13.5, 6.5, hdrs, rows_, col_x)

    # ── Notes ─────────────────────────────────────────────────────────────────
    ax.text(0.5, 5.8, '\n'.join([
        'NOTES:',
        '1. Per ASME B31.3 Process Piping — socket weld examination',
        '2. Material: ASTM A312 TP316L Stainless Steel pipe; A182 F316L fitting',
        '3. Film density: 2.0 – 3.5 per ASTM E94',
        '4. IQI: ASTM E747 wire set, 2T sensitivity required',
        '5. Single-wall single-image (SWSI) — 2 shots for 360° coverage',
        '6. Gap between pipe & socket shall be 1/16" min per B31.3',
    ]), va='top', fontsize=7.5, color=NAVY,
    bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))

    title_block(fig, 'RT-TEST-SOCKET-WELD-001',
                '1" NPS SCH 80 Socket Weld Fitting — 316L SS',
                'Socket Fillet Weld RT Plan — 2-Shot SWSI',
                'ASME B31.3', 'ASTM A312 TP316L / A182 F316L')
    fig.savefig(out, format='pdf', bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f'Saved: {out}')


# ══════════════════════════════════════════════════════════════════════════════
# 4. FLAT PLATE DOUBLE-V BUTT WELD — 5-shot (variable width)
# ══════════════════════════════════════════════════════════════════════════════

def gen_flat_plate_butt():
    out = os.path.join(BASE, 'RT-TEST-CLEAN-FLAT-PLATE-BUTT.pdf')
    fig = plt.figure(figsize=(17, 11), facecolor='white')
    ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
    ax.set_xlim(0, 20); ax.set_ylim(0, 13)
    ax.set_aspect('equal'); ax.axis('off')
    ax.set_title('RADIOGRAPHIC TESTING PLAN — FLAT PLATE DOUBLE-V BUTT WELD  (PL 25mm  ALLOY STEEL)',
                 fontsize=10, fontweight='bold', color=NAVY, pad=10)

    # ── Cross section (weld profile) ──────────────────────────────────────────
    ax.text(4.5, 12.5, 'WELD CROSS-SECTION (DOUBLE-VEE GROOVE)', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Plate halves
    ax.add_patch(mpatches.FancyBboxPatch((0.5, 9.0), 3.5, 1.8,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.add_patch(mpatches.FancyBboxPatch((5.0, 9.0), 3.5, 1.8,
                  boxstyle='round,pad=0.04', ec=NAVY, fc='#C8D8EC', lw=2))
    ax.text(2.25, 9.8, 'PL 25mm', ha='center', fontsize=7.5, color=NAVY, fontweight='bold')
    ax.text(6.75, 9.8, 'PL 25mm', ha='center', fontsize=7.5, color=NAVY, fontweight='bold')

    # Double-V weld profile (diamond shape)
    weld_poly_x = [4.0, 4.5, 5.0, 4.75, 4.25]
    weld_poly_y = [9.9, 10.8, 9.9, 9.0, 9.0]
    weld_poly_x.append(weld_poly_x[0]); weld_poly_y.append(weld_poly_y[0])
    ax.fill(weld_poly_x[:-1], weld_poly_y[:-1], color='#FFE0A0', ec=AMBER, lw=2, zorder=3)
    ax.text(4.5, 11.1, 'DOUBLE-V WELD', ha='center', fontsize=7.5,
            fontweight='bold', color=AMBER)

    # Weld dimensions
    ax.annotate('', xy=(4.0, 8.7), xytext=(5.0, 8.7),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(4.5, 8.45, 'ROOT GAP 3mm', ha='center', fontsize=7, color=NAVY)
    ax.annotate('', xy=(0.3, 9.0), xytext=(0.3, 10.8),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(-0.2, 9.9, 'PL\n25mm', ha='center', fontsize=7, color=NAVY)

    # Source above
    ax.add_patch(plt.Circle((4.5, 12.3), 0.3, ec=RED, fc='#FFCCCC', lw=2, zorder=5))
    ax.text(4.5, 12.3, 'S', ha='center', va='center', fontsize=9, fontweight='bold', color=RED)
    ax.annotate('', xy=(4.5, 11.3), xytext=(4.5, 12.0),
                arrowprops=dict(arrowstyle='-|>', color=RED, lw=2, mutation_scale=14))
    ax.text(5.2, 11.75, 'SFD\n850mm', fontsize=7.5, color=RED)

    # Film dashed line below
    ax.plot([0.5, 8.5], [8.7, 8.7], color=GREEN, lw=2.5, ls='--')
    ax.text(4.5, 8.4, 'FILM: 4×10"  CLASS D5  IQI WIRE SET (FILM SIDE)',
            ha='center', fontsize=7.5, color=GREEN, fontweight='bold')

    # ── Plan view (5 shots along weld) ───────────────────────────────────────
    ax.text(14.0, 12.5, 'PLAN VIEW — 5-SHOT LAYOUT', ha='center',
            fontsize=9, fontweight='bold', color=MUTED)

    # Plate outline
    ax.add_patch(mpatches.FancyBboxPatch((10.0, 8.5), 9.0, 3.5,
                  boxstyle='round,pad=0.1', ec=NAVY, fc='#C8D8EC', lw=2))
    # Weld seam (center line)
    ax.plot([10.0, 19.0], [10.25, 10.25], color=AMBER, lw=3)
    ax.text(14.5, 11.7, 'WELD SEAM — 1200mm TOTAL LENGTH', ha='center',
            fontsize=7.5, color=AMBER, fontweight='bold')

    # 5 shot coverage boxes
    shot_cols = [RED, '#8B1A8B', GREEN, BLUE, '#CC6600']
    shot_labels_plan = ['SH1', 'SH2', 'SH3', 'SH4', 'SH5']
    for i, (col, lbl) in enumerate(zip(shot_cols, shot_labels_plan)):
        x0 = 10.3 + i * 1.7
        ax.add_patch(mpatches.FancyBboxPatch((x0, 9.2), 1.5, 2.1,
                      boxstyle='round,pad=0.05', ec=col, fc=col, alpha=0.15, lw=2, zorder=3))
        ax.text(x0 + 0.75, 11.2, lbl, ha='center', fontsize=7.5, color=col,
                fontweight='bold')
        ax.text(x0 + 0.75, 8.8, f'{240*i}–{240*(i+1)}mm', ha='center',
                fontsize=6.5, color=MUTED)

    ax.annotate('', xy=(10.3, 8.2), xytext=(18.8, 8.2),
                arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
    ax.text(14.5, 7.9, 'TOTAL WELD LENGTH = 1200mm (5 × 240mm SHOTS)', ha='center',
            fontsize=7.5, color=NAVY)

    # ── Exposure table ────────────────────────────────────────────────────────
    hdrs = ['SHOT', 'LOCATION (mm)', 'TECHNIQUE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'TIME(min)']
    rows_ = [
        ['1', '0 – 240',     'SWSI', '140', '4.0', '850', '4×10 D5', '7'],
        ['2', '220 – 460',   'SWSI', '140', '4.0', '850', '4×10 D5', '7'],
        ['3', '440 – 680',   'SWSI', '140', '4.0', '850', '4×10 D5', '7'],
        ['4', '660 – 900',   'SWSI', '140', '4.0', '850', '4×10 D5', '7'],
        ['5', '880 – 1200',  'SWSI', '140', '4.0', '850', '4×10 D5', '7'],
    ]
    col_x = [9.3, 10.7, 11.9, 13.0, 13.8, 14.8, 15.8, 17.1]
    table(ax, 13.5, 6.8, hdrs, rows_, col_x)

    # ── Notes ─────────────────────────────────────────────────────────────────
    ax.text(0.5, 5.8, '\n'.join([
        'NOTES:',
        '1. Per ASME Sec IX / AWS D1.1 — butt weld RT procedure',
        '2. Material: ASTM A387 Gr.11 Cl.2 Alloy Steel (1.25Cr-0.5Mo)',
        '3. Film density range: 2.0 – 3.5 per ASTM E94',
        '4. IQI: ASTM E747 wire set, 2T sensitivity, film-side placement',
        '5. 20mm minimum overlap between adjacent shots',
        '6. Preheat 150°C per ASME Sec IX P-No.4 requirements',
    ]), va='top', fontsize=7.5, color=NAVY,
    bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))

    title_block(fig, 'RT-TEST-FLAT-BUTT-001',
                'A387 Gr.11 Alloy Steel — PL 25mm Butt Weld',
                'Double-V Butt Weld RT Plan — 5-Shot SWSI',
                'ASME Sec IX / AWS D1.1', 'ASTM A387 Gr.11 Cl.2')
    fig.savefig(out, format='pdf', bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f'Saved: {out}')


# ── Run all ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    gen_pressure_vessel()
    gen_t_joint()
    gen_socket_weld()
    gen_flat_plate_butt()
    print('All 4 diagrams generated.')
