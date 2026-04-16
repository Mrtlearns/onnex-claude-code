"""
Generate a minimal RT drawing with NO PII and NO ITAR/EAR keywords.
Routes as CLEAN / CLOUD_OK for testing the cloud LLM path.

Output: RT-TEST-CLEAN-PIPE-WELD.pdf
"""
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "RT-TEST-CLEAN-PIPE-WELD.pdf")

NAVY = '#1A2E4A'
BLUE = '#1F5C99'
AMBER = '#D97B06'
GREEN = '#1A7A3C'
MUTED = '#6B7280'
RED = '#C0392B'
LIGHT = '#EBF3FB'

fig = plt.figure(figsize=(17, 11), facecolor='white')
ax = fig.add_axes([0.04, 0.19, 0.92, 0.78])
ax.set_xlim(0, 20); ax.set_ylim(0, 13)
ax.set_aspect('equal'); ax.axis('off')
ax.set_title('RADIOGRAPHIC TESTING PLAN — CARBON STEEL PIPE BUTT WELD (6" NPS SCH 40)',
             fontsize=11, fontweight='bold', color=NAVY, pad=10)

# ── Part cross-section ────────────────────────────────────────────────────────
ax.text(5, 12.5, 'WELD CROSS-SECTION (SINGLE-VEE)', ha='center',
        fontsize=9, fontweight='bold', color=MUTED)

# Pipe walls
ax.add_patch(mpatches.FancyBboxPatch((1.0, 8.0), 4.0, 1.5,
              boxstyle='round,pad=0.05', ec=NAVY, fc='#C8D8EC', lw=2))
ax.add_patch(mpatches.FancyBboxPatch((5.5, 8.0), 4.0, 1.5,
              boxstyle='round,pad=0.05', ec=NAVY, fc='#C8D8EC', lw=2))
# Weld crown
weld_x = [5.0, 5.2, 5.5, 5.8, 6.0]
weld_y = [9.5, 9.75, 9.9, 9.75, 9.5]
ax.fill_between(weld_x, [8.0]*5, weld_y, color='#FFE0A0', alpha=0.9, zorder=3)
ax.plot(weld_x, weld_y, color=AMBER, lw=2)
ax.plot([5.0, 6.0], [8.0, 8.0], color=AMBER, lw=2)
ax.text(5.5, 8.0 - 0.4, 'BUTT WELD', ha='center', fontsize=8,
        fontweight='bold', color=AMBER)

# Dimensions
ax.annotate('', xy=(1.0, 7.6), xytext=(5.0, 7.6),
            arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
ax.text(3.0, 7.35, 'OD = 168.3 mm', ha='center', fontsize=7.5, color=NAVY)
ax.annotate('', xy=(0.7, 8.0), xytext=(0.7, 9.5),
            arrowprops=dict(arrowstyle='<->', color=NAVY, lw=0.8))
ax.text(0.1, 8.75, 'WT\n7.1mm', ha='center', fontsize=7, color=NAVY)

# Source position
ax.add_patch(plt.Circle((5.5, 12.0), 0.35, ec=RED, fc='#FFCCCC', lw=2, zorder=5))
ax.text(5.5, 12.0, 'S', ha='center', va='center', fontsize=9,
        fontweight='bold', color=RED)
ax.annotate('', xy=(5.5, 10.5), xytext=(5.5, 11.65),
            arrowprops=dict(arrowstyle='-|>', color=RED, lw=2, mutation_scale=15))
ax.text(6.0, 11.1, 'CENTRAL\nBEAM', fontsize=7.5, color=RED)

# FFD
ax.annotate('', xy=(6.2, 12.0), xytext=(6.2, 10.5),
            arrowprops=dict(arrowstyle='<->', color=MUTED, lw=0.8))
ax.text(6.8, 11.25, 'SFD\n760mm', ha='left', fontsize=7, color=MUTED)

# Film (dashed line below pipe)
ax.plot([1.5, 9.5], [7.7, 7.7], color=GREEN, lw=2.5, ls='--')
ax.text(5.5, 7.4, 'FILM: 4×10"  CLASS D5  IQI WIRE SET (FILM SIDE)',
        ha='center', fontsize=7.5, color=GREEN, fontweight='bold')

# ── Shot diagram (circular pipe cross-section view) ────────────────────────
ax.text(13.0, 12.5, 'SHOT GEOMETRY (PIPE CROSS-SECTION)',
        ha='center', fontsize=9, fontweight='bold', color=MUTED)

cx, cy = 13.0, 9.5
ax.add_patch(plt.Circle((cx, cy), 2.5, ec=NAVY, fc='#C8D8EC', lw=2))
ax.add_patch(plt.Circle((cx, cy), 1.9, ec=NAVY, fc='white', lw=1.5))
ax.text(cx, cy, '6" SCH 40\nOD 168.3mm\nWT 7.1mm', ha='center', va='center',
        fontsize=7, color=NAVY)

# 3 shot positions
shots = [
    (0,   'S1', 'SHOT 1\n0°',    RED,     'Straight, 1 film'),
    (120, 'S2', 'SHOT 2\n120°',  '#8B1A8B', 'Ellipse, 1 film'),
    (240, 'S3', 'SHOT 3\n240°',  GREEN,   'Ellipse, 1 film'),
]
for ang, sid, label, color, note in shots:
    rad = np.radians(ang + 90)
    sx = cx + 3.8 * np.cos(rad)
    sy = cy + 3.8 * np.sin(rad)
    ax.add_patch(plt.Circle((sx, sy), 0.25, ec=color, fc='#FFCCCC', lw=2, zorder=5))
    ax.text(sx, sy, sid, ha='center', va='center', fontsize=6.5,
            fontweight='bold', color=color)
    # Arrow toward pipe
    dx = (cx - sx); dy = (cy - sy)
    dl = np.hypot(dx, dy)
    ax.annotate('', xy=(cx + (r_in := 2.55) * (-(cx-sx)/dl),
                         cy + r_in * (-(cy-sy)/dl)),
                xytext=(sx + 0.28 * (dx/dl), sy + 0.28 * (dy/dl)),
                arrowprops=dict(arrowstyle='-|>', color=color, lw=1.5,
                                mutation_scale=12))
    # label outside
    lx = cx + 4.8 * np.cos(rad)
    ly = cy + 4.8 * np.sin(rad)
    ax.text(lx, ly, f'{label}\n{note}', ha='center', va='center',
            fontsize=7, color=color, fontweight='bold')

# ── Exposure schedule ─────────────────────────────────────────────────────────
ax.text(10, 6.0, 'EXPOSURE SCHEDULE', ha='center', fontsize=9,
        fontweight='bold', color=NAVY)
headers = ['SHOT', 'ANGLE', 'TECHNIQUE', 'kV', 'mA', 'SFD(mm)', 'FILM', 'TIME(min)']
col_x = [9.2, 10.0, 11.1, 12.3, 13.1, 13.9, 15.1, 16.5]
for h, x in zip(headers, col_x):
    ax.text(x, 5.6, h, ha='center', fontsize=6.5, fontweight='bold',
            color='white',
            bbox=dict(boxstyle='square,pad=0.15', fc=NAVY, ec=NAVY))

rows = [
    ['1', '0°',   'STRAIGHT', '120', '4.0', '760', '4×10 D5', '8'],
    ['2', '120°', 'ELLIPSE',  '120', '4.0', '760', '4×10 D5', '10'],
    ['3', '240°', 'ELLIPSE',  '120', '4.0', '760', '4×10 D5', '10'],
]
for ri, row in enumerate(rows):
    ry = 5.0 - ri * 0.7
    bg = LIGHT if ri % 2 == 0 else 'white'
    ax.add_patch(mpatches.FancyBboxPatch((9.0, ry - 0.18), 8.3, 0.55,
                  boxstyle='square,pad=0', fc=bg, ec='none', zorder=1))
    for val, x in zip(row, col_x):
        ax.text(x, ry + 0.06, val, ha='center', fontsize=7, color='black', zorder=2)

# ── Notes (no PII) ────────────────────────────────────────────────────────────
ax.text(9.0, 2.9, '\n'.join([
    'NOTES:',
    '1. Per ASME B31.3 Process Piping — 100% RT required on welds',
    '2. Material: ASTM A106 Gr.B Carbon Steel pipe',
    '3. Film density range: 2.0 – 3.5 (ASTM E94)',
    '4. IQI: ASTM E747 wire penetrameter, 2T sensitivity',
    '5. Complete all 3 shots in same session — no interruption',
    '6. Geometric Ug ≤ 0.51mm, focal spot 1.5mm @ 760mm SFD',
]), va='top', fontsize=7.5, color=NAVY,
bbox=dict(boxstyle='round,pad=0.4', fc=LIGHT, ec=NAVY, lw=0.8))

# ── Minimal title block (NO PII) ─────────────────────────────────────────────
tb = fig.add_axes([0.01, 0.01, 0.98, 0.16], frameon=True)
tb.set_xlim(0, 100); tb.set_ylim(0, 100)
tb.set_xticks([]); tb.set_yticks([])
for spine in tb.spines.values():
    spine.set_linewidth(1.5); spine.set_color(NAVY)
tb.patch.set_facecolor('#F0F4F8')

tb.text(20, 88, 'NDT INSPECTION SERVICES', ha='center', fontsize=9,
        fontweight='bold', color=NAVY)
tb.text(20, 75, '6" NPS SCH 40 Carbon Steel Pipe', ha='center',
        fontsize=8, color='black')
tb.text(20, 62, 'Butt Weld RT Plan — 3 Shot Positions', ha='center',
        fontsize=8, color='black')
tb.text(20, 48, 'ACCEPTANCE STD: ASME B31.3', ha='center',
        fontsize=8, fontweight='bold', color=NAVY)
tb.text(20, 35, 'Date: 2025-02-10    Rev: A', ha='center',
        fontsize=7.5, color=MUTED)

tb.text(57.5, 85, 'DRAWING NUMBER', ha='center', fontsize=8,
        fontweight='bold', color=NAVY)
tb.text(57.5, 70, 'RT-TEST-PIPE-6NPS-001', ha='center', fontsize=11,
        fontweight='bold', color=NAVY)
tb.text(57.5, 50, 'MATERIAL: ASTM A106 Gr.B', ha='center', fontsize=8, color='black')
tb.text(57.5, 35, 'SCALE: 1:5   SHEET: 1 of 1', ha='center',
        fontsize=7.5, color=MUTED)

tb.text(82, 85, 'NDT STANDARD', ha='center', fontsize=8,
        fontweight='bold', color=NAVY)
tb.text(82, 70, 'ASME Sec V Art. 2', ha='center', fontsize=9, color='black')
tb.text(82, 55, 'ASTM E94', ha='center', fontsize=9, color='black')
tb.text(82, 35, 'DISTRIBUTION: UNRESTRICTED', ha='center',
        fontsize=7.5, color=GREEN)

fig.savefig(OUT, format='pdf', bbox_inches='tight', dpi=150)
plt.close(fig)
print(f'Saved: {OUT}')
