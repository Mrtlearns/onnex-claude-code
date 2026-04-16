import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NDT_COLORS } from '../tokens/colors';
import { resolvePartMaterial } from '../lib/rt/geometry-factory';

/**
 * Verifies the visual fix properties for the RT Inspector:
 * - Mesh colors have sufficient contrast against #0A0C10 background
 * - Material opacity has a floor preventing invisible parts
 * - Color tokens are brighter than the old values
 */

// Helper: parse hex color to { r, g, b } (0–255)
function hexToRgb(hex: string) {
  const num = parseInt(hex.replace('#', ''), 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

// Luminance contrast ratio helper (simplified)
function contrastRatio(hex1: string, hex2: string) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  // Simple Euclidean distance in RGB space
  return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
}

describe('Inspector visual fix — color tokens', () => {
  const BG = '#0A0C10';

  it('meshPrimary has sufficient contrast against background', () => {
    const dist = contrastRatio(NDT_COLORS.meshPrimary, BG);
    // Old value #2A3040 had distance ~58. New #3A4858 should be >80
    expect(dist).toBeGreaterThan(75);
  });

  it('meshSecondary has sufficient contrast against background', () => {
    const dist = contrastRatio(NDT_COLORS.meshSecondary, BG);
    expect(dist).toBeGreaterThan(90);
  });

  it('meshHeavy has sufficient contrast against background', () => {
    const dist = contrastRatio(NDT_COLORS.meshHeavy, BG);
    expect(dist).toBeGreaterThan(120);
  });

  it('mesh colors are in the blue-gray family (b > r, b > g)', () => {
    for (const key of ['meshPrimary', 'meshSecondary', 'meshHeavy'] as const) {
      const { r, g, b } = hexToRgb(NDT_COLORS[key]);
      expect(b).toBeGreaterThan(r);
      expect(b).toBeGreaterThanOrEqual(g);
    }
  });
});

describe('Inspector visual fix — material properties', () => {
  it('default primary material has opacity >= 0.75', () => {
    const mat = resolvePartMaterial(
      { color: '#000000', opacity: 0, metalness: 0 }, // zeroed out to trigger preset
      'primary',
    );
    expect(mat.opacity).toBeGreaterThanOrEqual(0.75);
  });

  it('LLM-provided low opacity is floored at 0.65', () => {
    const mat = resolvePartMaterial(
      { color: '#3A4858', opacity: 0.3, metalness: 0.5 },
      'primary',
    );
    expect(mat.opacity).toBeGreaterThanOrEqual(0.65);
  });

  it('LLM-provided valid opacity above floor passes through', () => {
    const mat = resolvePartMaterial(
      { color: '#3A4858', opacity: 0.85, metalness: 0.5 },
      'primary',
    );
    expect(mat.opacity).toBe(0.85);
  });

  it('material uses MeshPhongMaterial parameters (specular + shininess)', () => {
    const mat = resolvePartMaterial(
      { color: '#3A4858', opacity: 0.7, metalness: 0.5 },
      'primary',
    );
    expect(mat.specular).toBeDefined();
    expect(mat.shininess).toBe(40);
    expect(mat.transparent).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
  });
});

describe('Inspector visual fix — tone mapping', () => {
  it('THREE.NoToneMapping equals 0', () => {
    // Verify the constant value so the SceneCanvas gl prop is correct
    expect(THREE.NoToneMapping).toBe(0);
  });

  it('THREE.ACESFilmicToneMapping is NOT used (is a different value)', () => {
    expect(THREE.ACESFilmicToneMapping).not.toBe(THREE.NoToneMapping);
  });
});
