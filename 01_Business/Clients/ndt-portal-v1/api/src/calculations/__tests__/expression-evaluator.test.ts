import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateExpressionRaw, type EvalContext } from '../expression-evaluator';

describe('expression-evaluator', () => {
  // ── Basic Arithmetic ──────────────────────────────────────────
  describe('arithmetic', () => {
    it('adds two numbers', () => {
      expect(evaluateExpression('2 + 3', {})).toBe(5);
    });

    it('subtracts', () => {
      expect(evaluateExpression('10 - 4', {})).toBe(6);
    });

    it('multiplies', () => {
      expect(evaluateExpression('6 * 7', {})).toBe(42);
    });

    it('divides', () => {
      expect(evaluateExpression('10 / 4', {})).toBe(2.5);
    });

    it('division by zero returns 0', () => {
      expect(evaluateExpression('5 / 0', {})).toBe(0);
    });

    it('respects operator precedence', () => {
      expect(evaluateExpression('2 + 3 * 4', {})).toBe(14);
    });

    it('respects parentheses', () => {
      expect(evaluateExpression('(2 + 3) * 4', {})).toBe(20);
    });

    it('handles unary minus', () => {
      expect(evaluateExpression('-5 + 3', {})).toBe(-2);
    });

    it('handles nested parentheses', () => {
      expect(evaluateExpression('((2 + 3) * (4 - 1)) / 5', {})).toBe(3);
    });

    it('handles decimals', () => {
      expect(evaluateExpression('3.625 + 11.625', {})).toBe(15.25);
    });
  });

  // ── Built-in Functions ────────────────────────────────────────
  describe('functions', () => {
    it('CEIL rounds up', () => {
      expect(evaluateExpression('CEIL(3.2)', {})).toBe(4);
    });

    it('CEIL negative', () => {
      expect(evaluateExpression('CEIL(-3.7)', {})).toBe(-3);
    });

    it('FLOOR rounds down', () => {
      expect(evaluateExpression('FLOOR(3.7)', {})).toBe(3);
    });

    it('MAX returns largest', () => {
      expect(evaluateExpression('MAX(3, 7)', {})).toBe(7);
    });

    it('MIN returns smallest', () => {
      expect(evaluateExpression('MIN(3, 7)', {})).toBe(3);
    });

    it('POW computes power', () => {
      expect(evaluateExpression('POW(2, 10)', {})).toBe(1024);
    });

    it('ABS of negative', () => {
      expect(evaluateExpression('ABS(-42)', {})).toBe(42);
    });

    it('ROUNDUP1 rounds up to 1 decimal', () => {
      expect(evaluateExpression('ROUNDUP1(3.14)', {})).toBe(3.2);
    });

    it('ROUNDUP1 of exact value stays same', () => {
      expect(evaluateExpression('ROUNDUP1(3.0)', {})).toBe(3.0);
    });

    it('ROUNDUP1 of 3.01 rounds to 3.1', () => {
      expect(evaluateExpression('ROUNDUP1(3.01)', {})).toBe(3.1);
    });

    it('nested function calls', () => {
      expect(evaluateExpression('CEIL(MAX(3.2, 4.7))', {})).toBe(5);
    });
  });

  // ── Constants ─────────────────────────────────────────────────
  describe('constants', () => {
    it('PI is approximately 3.14159', () => {
      const result = evaluateExpression('PI', {});
      expect(result).toBeCloseTo(Math.PI, 10);
    });

    it('PI in formula', () => {
      const result = evaluateExpression('PI * 2.5', {});
      expect(result).toBeCloseTo(Math.PI * 2.5, 10);
    });
  });

  // ── Variable Access ───────────────────────────────────────────
  describe('variables', () => {
    it('simple variable', () => {
      expect(evaluateExpression('x', { x: 42 })).toBe(42);
    });

    it('dot-notation access', () => {
      const ctx: EvalContext = { dims: { width: 11.625 } };
      expect(evaluateExpression('dims.width', ctx)).toBe(11.625);
    });

    it('deep dot-notation', () => {
      const ctx: EvalContext = { customer: { cscan_rate: 250 } };
      expect(evaluateExpression('customer.cscan_rate', ctx)).toBe(250);
    });

    it('undefined variable returns 0 (numeric context)', () => {
      expect(evaluateExpression('x + 1', {})).toBe(1);
    });

    it('null variable returns 0 (numeric context)', () => {
      expect(evaluateExpression('x + 1', { x: null })).toBe(1);
    });
  });

  // ── Comparison Operators ──────────────────────────────────────
  describe('comparison', () => {
    it('== returns true for equal values', () => {
      expect(evaluateExpressionRaw('x == 5', { x: 5 })).toBe(true);
    });

    it('!= returns true for different values', () => {
      expect(evaluateExpressionRaw('x != 5', { x: 3 })).toBe(true);
    });

    it('> works correctly', () => {
      expect(evaluateExpressionRaw('x > 0', { x: 5 })).toBe(true);
      expect(evaluateExpressionRaw('x > 0', { x: -1 })).toBe(false);
    });

    it('<= works correctly', () => {
      expect(evaluateExpressionRaw('x <= 10', { x: 10 })).toBe(true);
    });
  });

  // ── Ternary Operator ──────────────────────────────────────────
  describe('ternary', () => {
    it('returns consequent when true', () => {
      expect(evaluateExpression('x > 0 ? x : 0', { x: 5 })).toBe(5);
    });

    it('returns alternate when false', () => {
      expect(evaluateExpression('x > 0 ? x : 0', { x: -3 })).toBe(0);
    });

    it('boolean variable as condition', () => {
      expect(evaluateExpression('flag ? 100 : 0', { flag: true })).toBe(100);
      expect(evaluateExpression('flag ? 100 : 0', { flag: false })).toBe(0);
    });

    it('nested ternary', () => {
      // a == 1 ? 10 : a == 2 ? 20 : 30
      expect(evaluateExpression('a == 1 ? 10 : a == 2 ? 20 : 30', { a: 1 })).toBe(10);
      expect(evaluateExpression('a == 1 ? 10 : a == 2 ? 20 : 30', { a: 2 })).toBe(20);
      expect(evaluateExpression('a == 1 ? 10 : a == 2 ? 20 : 30', { a: 3 })).toBe(30);
    });
  });

  // ── Null Coalescing ───────────────────────────────────────────
  describe('null coalescing', () => {
    it('returns left when non-null', () => {
      expect(evaluateExpression('x ?? 10', { x: 5 })).toBe(5);
    });

    it('returns right when left is null', () => {
      expect(evaluateExpression('x ?? 10', { x: null })).toBe(10);
    });

    it('returns right when left is undefined', () => {
      expect(evaluateExpression('x ?? 10', {})).toBe(10);
    });

    it('chained null coalescing', () => {
      expect(evaluateExpression('a ?? b ?? 0', { a: null, b: null })).toBe(0);
      expect(evaluateExpression('a ?? b ?? 0', { a: null, b: 7 })).toBe(7);
    });

    it('dot-access with null coalescing', () => {
      const ctx: EvalContext = {
        material: { class_aa_rate_per_lb: null, class_a_rate_per_lb: 0.12 },
      };
      expect(evaluateExpression(
        'material.class_aa_rate_per_lb ?? material.class_a_rate_per_lb ?? 0',
        ctx,
      )).toBe(0.12);
    });
  });

  // ── String Comparison ─────────────────────────────────────────
  describe('string comparison', () => {
    it('compares string equality', () => {
      const ctx: EvalContext = { inspClass: 'AA' };
      expect(evaluateExpressionRaw("inspClass == 'AA'", ctx)).toBe(true);
      expect(evaluateExpressionRaw("inspClass == 'A'", ctx)).toBe(false);
    });
  });

  // ── Real UT Calculator Formulas ───────────────────────────────
  describe('real UT formulas', () => {
    const standardCtx: EvalContext = {
      dims: { width: 11.625, thickness: 3.625, length: 15.75, diameter: 0, od: 0, id_: 0, numScans: 1 },
      scanIndex: 0.065,
      scanSpeedDivisor: 10,
      loadTime: 3,
      hourlyRate: 225,
    };

    it('FLAT_BAR indexes formula', () => {
      const result = evaluateExpression('(dims.width + dims.thickness) / scanIndex', standardCtx);
      expect(result).toBeCloseTo((11.625 + 3.625) / 0.065, 6);
    });

    it('FLAT_BAR secPerScanline', () => {
      const result = evaluateExpression('dims.length / scanSpeedDivisor', standardCtx);
      expect(result).toBe(1.575);
    });

    it('ROUND_BAR circumference-based indexes', () => {
      const ctx: EvalContext = {
        ...standardCtx,
        dims: { ...standardCtx.dims as EvalContext, diameter: 2.5 },
      };
      const result = evaluateExpression('CEIL(PI * dims.diameter / scanIndex)', ctx);
      expect(result).toBe(Math.ceil(Math.PI * 2.5 / 0.065));
    });

    it('RING wall thickness', () => {
      const ctx: EvalContext = {
        dims: { od: 10, id_: 6 },
      };
      expect(evaluateExpression('(dims.od - dims.id_) / 2', ctx)).toBe(2);
    });

    it('ROUNDUP1 price calculation', () => {
      // ROUNDUP1((totalTimeMin / 60) * hourlyRate)
      const ctx: EvalContext = { totalTimeMin: 9.615, hourlyRate: 225 };
      const expected = Math.ceil(((9.615 / 60) * 225) * 10) / 10;
      expect(evaluateExpression('ROUNDUP1((totalTimeMin / 60) * hourlyRate)', ctx)).toBe(expected);
    });

    it('lot calculation: MAX for min charge enforcement', () => {
      const ctx: EvalContext = { extPrice: 15.5, minCharge: 225 };
      expect(evaluateExpression('MAX(extPrice, minCharge)', ctx)).toBe(225);
    });

    it('weight cubic inches for flat geometry', () => {
      const ctx: EvalContext = { dims: { thickness: 3.625, width: 11.625, length: 15.75 } };
      const expected = 3.625 * 11.625 * 15.75;
      expect(evaluateExpression('dims.thickness * dims.width * dims.length', ctx)).toBeCloseTo(expected, 6);
    });

    it('weight cubic inches for round geometry', () => {
      const ctx: EvalContext = { dims: { diameter: 4 } };
      // PI * (diameter/2)^2 * length... but let's test the POW part
      const expected = Math.PI * Math.pow(4 / 2, 2);
      expect(evaluateExpression('PI * POW(dims.diameter / 2, 2)', ctx)).toBeCloseTo(expected, 6);
    });

    it('ternary lot pattern: min_enforced vs simple', () => {
      // Simulating: lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice
      expect(evaluateExpression(
        'lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice',
        { lotPattern_min_enforced: true, extPrice: 15.5, minCharge: 225 },
      )).toBe(225);

      expect(evaluateExpression(
        'lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice',
        { lotPattern_min_enforced: false, extPrice: 15.5, minCharge: 225 },
      )).toBe(15.5);
    });
  });

  // ── Error Handling ────────────────────────────────────────────
  describe('error handling', () => {
    it('throws on unknown function', () => {
      expect(() => evaluateExpression('UNKNOWN(5)', {})).toThrow('Unknown function: UNKNOWN');
    });

    it('throws on unexpected character', () => {
      expect(() => evaluateExpression('5 & 3', {})).toThrow('Unexpected character');
    });

    it('throws on mismatched parens', () => {
      expect(() => evaluateExpression('(5 + 3', {})).toThrow();
    });
  });
});
