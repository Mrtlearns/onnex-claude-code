/**
 * Safe math expression evaluator for the UT rule engine.
 * Uses a tokenizer + recursive descent parser — NO eval().
 *
 * Supported:
 *   Arithmetic: + - * /
 *   Functions:  CEIL, FLOOR, MAX, MIN, POW, ABS, ROUNDUP1
 *   Constants:  PI
 *   Variables:  dot-notation (dims.width, customer.hourly_rate)
 *   Ternary:    condition ? a : b
 *   Null coal:  a ?? b
 *   Comparison: == != > < >= <=
 *   Boolean:    true, false
 */

// ── Types ────────────────────────────────────────────────────────

export interface EvalContext {
  [key: string]: number | string | boolean | null | undefined | EvalContext;
}

// ── Token Types ──────────────────────────────────────────────────

type TokenType =
  | 'NUMBER' | 'STRING' | 'IDENT' | 'DOT'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LTE' | 'GTE'
  | 'QMARK' | 'COLON' | 'NULLCOAL'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// ── Tokenizer ────────────────────────────────────────────────────

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[i])) { i++; continue; }

    const pos = i;

    // Number (including decimals)
    if (/[0-9]/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'NUMBER', value: num, pos });
      continue;
    }

    // String literal (single-quoted)
    if (expr[i] === "'") {
      i++; // skip opening quote
      let str = '';
      while (i < expr.length && expr[i] !== "'") { str += expr[i]; i++; }
      if (i < expr.length) i++; // skip closing quote
      tokens.push({ type: 'STRING', value: str, pos });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      tokens.push({ type: 'IDENT', value: ident, pos });
      continue;
    }

    // Two-char operators
    if (i + 1 < expr.length) {
      const two = expr[i] + expr[i + 1];
      if (two === '??') { tokens.push({ type: 'NULLCOAL', value: '??', pos }); i += 2; continue; }
      if (two === '==') { tokens.push({ type: 'EQ', value: '==', pos }); i += 2; continue; }
      if (two === '!=') { tokens.push({ type: 'NEQ', value: '!=', pos }); i += 2; continue; }
      if (two === '<=') { tokens.push({ type: 'LTE', value: '<=', pos }); i += 2; continue; }
      if (two === '>=') { tokens.push({ type: 'GTE', value: '>=', pos }); i += 2; continue; }
    }

    // Single-char operators
    const singleCharMap: Record<string, TokenType> = {
      '+': 'PLUS', '-': 'MINUS', '*': 'STAR', '/': 'SLASH',
      '(': 'LPAREN', ')': 'RPAREN', '[': 'LBRACKET', ']': 'RBRACKET',
      ',': 'COMMA', '.': 'DOT', '?': 'QMARK', ':': 'COLON',
      '<': 'LT', '>': 'GT',
    };
    if (singleCharMap[expr[i]]) {
      tokens.push({ type: singleCharMap[expr[i]], value: expr[i], pos });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${expr[i]}' at position ${i} in: ${expr}`);
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ── AST Node Types ───────────────────────────────────────────────

type ASTNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'ident'; name: string }
  | { kind: 'dot'; object: ASTNode; property: string }
  | { kind: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { kind: 'unary'; op: string; operand: ASTNode }
  | { kind: 'ternary'; condition: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { kind: 'nullcoal'; left: ASTNode; right: ASTNode }
  | { kind: 'call'; name: string; args: ASTNode[] };

// ── Parser ───────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private expr: string;

  constructor(tokens: Token[], expr: string) {
    this.tokens = tokens;
    this.expr = expr;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }

  private expect(type: TokenType): Token {
    const t = this.advance();
    if (t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} ('${t.value}') at pos ${t.pos} in: ${this.expr}`);
    }
    return t;
  }

  parse(): ASTNode {
    const node = this.parseTernary();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token '${this.peek().value}' at pos ${this.peek().pos} in: ${this.expr}`);
    }
    return node;
  }

  // ternary: nullcoal ? nullcoal : nullcoal
  private parseTernary(): ASTNode {
    let node = this.parseNullCoal();
    if (this.peek().type === 'QMARK') {
      this.advance(); // skip ?
      const consequent = this.parseTernary();
      this.expect('COLON');
      const alternate = this.parseTernary();
      node = { kind: 'ternary', condition: node, consequent, alternate };
    }
    return node;
  }

  // nullcoal: comparison ?? comparison
  private parseNullCoal(): ASTNode {
    let node = this.parseComparison();
    while (this.peek().type === 'NULLCOAL') {
      this.advance();
      const right = this.parseComparison();
      node = { kind: 'nullcoal', left: node, right };
    }
    return node;
  }

  // comparison: addSub (== | != | < | > | <= | >=) addSub
  private parseComparison(): ASTNode {
    let node = this.parseAddSub();
    const compOps: TokenType[] = ['EQ', 'NEQ', 'LT', 'GT', 'LTE', 'GTE'];
    while (compOps.includes(this.peek().type)) {
      const op = this.advance().value;
      const right = this.parseAddSub();
      node = { kind: 'binary', op, left: node, right };
    }
    return node;
  }

  // addSub: mulDiv (+ | -) mulDiv
  private parseAddSub(): ASTNode {
    let node = this.parseMulDiv();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.advance().value;
      const right = this.parseMulDiv();
      node = { kind: 'binary', op, left: node, right };
    }
    return node;
  }

  // mulDiv: unary (* | /) unary
  private parseMulDiv(): ASTNode {
    let node = this.parseUnary();
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
      const op = this.advance().value;
      const right = this.parseUnary();
      node = { kind: 'binary', op, left: node, right };
    }
    return node;
  }

  // unary: (- | +) unary | primary
  private parseUnary(): ASTNode {
    if (this.peek().type === 'MINUS') {
      this.advance();
      const operand = this.parseUnary();
      return { kind: 'unary', op: '-', operand };
    }
    if (this.peek().type === 'PLUS') {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  // primary: number | string | boolean | ident (with dot access and function calls) | (expr)
  private parsePrimary(): ASTNode {
    const t = this.peek();

    // Number
    if (t.type === 'NUMBER') {
      this.advance();
      return { kind: 'number', value: parseFloat(t.value) };
    }

    // String
    if (t.type === 'STRING') {
      this.advance();
      return { kind: 'string', value: t.value };
    }

    // Parenthesized expression
    if (t.type === 'LPAREN') {
      this.advance();
      const node = this.parseTernary();
      this.expect('RPAREN');
      return node;
    }

    // Identifier: could be variable, function call, boolean, or constant
    if (t.type === 'IDENT') {
      this.advance();
      const name = t.value;

      // Boolean literals
      if (name === 'true') return { kind: 'boolean', value: true };
      if (name === 'false') return { kind: 'boolean', value: false };

      // Constants
      if (name === 'PI') return { kind: 'number', value: Math.PI };

      // Function call: NAME(args)
      if (this.peek().type === 'LPAREN') {
        this.advance(); // skip (
        const args: ASTNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseTernary());
          while (this.peek().type === 'COMMA') {
            this.advance();
            args.push(this.parseTernary());
          }
        }
        this.expect('RPAREN');
        return { kind: 'call', name, args };
      }

      // Variable with dot access: customer.hourly_rate
      let node: ASTNode = { kind: 'ident', name };
      while (this.peek().type === 'DOT') {
        this.advance(); // skip .
        const prop = this.expect('IDENT');
        node = { kind: 'dot', object: node, property: prop.value };
      }
      return node;
    }

    throw new Error(`Unexpected token '${t.value}' (${t.type}) at pos ${t.pos} in: ${this.expr}`);
  }
}

// ── AST Evaluator ────────────────────────────────────────────────

const BUILT_IN_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  CEIL:     (n) => Math.ceil(n),
  FLOOR:    (n) => Math.floor(n),
  MAX:      (...args) => Math.max(...args),
  MIN:      (...args) => Math.min(...args),
  POW:      (base, exp) => Math.pow(base, exp),
  ABS:      (n) => Math.abs(n),
  ROUNDUP1: (n) => Math.ceil(n * 10) / 10,
};

type EvalResult = number | string | boolean | null | undefined;

function resolveContext(ctx: EvalContext, key: string): EvalResult {
  if (key in ctx) {
    const val = ctx[key];
    if (val === null || val === undefined) return val;
    if (typeof val === 'object') return undefined; // nested object, not a leaf
    return val;
  }
  return undefined;
}

function evaluateAST(node: ASTNode, ctx: EvalContext): EvalResult {
  switch (node.kind) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'boolean':
      return node.value;

    case 'ident': {
      const val = resolveContext(ctx, node.name);
      if (val === undefined && !(node.name in ctx)) {
        // Could be a nested object key — return undefined gracefully
        return undefined;
      }
      return val;
    }

    case 'dot': {
      // Walk the context using the full dot path (e.g. dims.width → ['dims', 'width'])
      const path = flattenDotPath(node);
      let current: unknown = ctx;
      for (const segment of path) {
        if (current === null || current === undefined || typeof current !== 'object') return null;
        current = (current as Record<string, unknown>)[segment];
      }
      // If we landed on a nested object, that's not a leaf value — return null
      if (current !== null && current !== undefined && typeof current === 'object') return null;
      return current as EvalResult;
    }

    case 'binary': {
      const left = evaluateAST(node.left, ctx);
      const right = evaluateAST(node.right, ctx);

      // Comparison operators work on any type
      switch (node.op) {
        case '==': return left === right || (left == right); // loose for null checks
        case '!=': return left !== right && (left != right);
        case '<':  return toNum(left) < toNum(right);
        case '>':  return toNum(left) > toNum(right);
        case '<=': return toNum(left) <= toNum(right);
        case '>=': return toNum(left) >= toNum(right);
      }

      // Arithmetic operators
      const l = toNum(left);
      const r = toNum(right);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? 0 : l / r;
        default:  throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }

    case 'unary': {
      const operand = toNum(evaluateAST(node.operand, ctx));
      if (node.op === '-') return -operand;
      throw new Error(`Unknown unary operator: ${node.op}`);
    }

    case 'ternary': {
      const cond = evaluateAST(node.condition, ctx);
      return toBool(cond)
        ? evaluateAST(node.consequent, ctx)
        : evaluateAST(node.alternate, ctx);
    }

    case 'nullcoal': {
      const left = evaluateAST(node.left, ctx);
      return (left === null || left === undefined) ? evaluateAST(node.right, ctx) : left;
    }

    case 'call': {
      const fn = BUILT_IN_FUNCTIONS[node.name];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      const args = node.args.map(a => toNum(evaluateAST(a, ctx)));
      return fn(...args);
    }

    default:
      throw new Error(`Unknown AST node kind: ${(node as ASTNode).kind}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function flattenDotPath(node: ASTNode): string[] {
  if (node.kind === 'ident') return [node.name];
  if (node.kind === 'dot') return [...flattenDotPath(node.object), node.property];
  throw new Error('Cannot flatten non-dot/ident node');
}

function toNum(val: EvalResult): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toBool(val: EvalResult): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.length > 0;
  return true;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Evaluate a math expression string against a context of named variables.
 * Returns a numeric result. Throws on parse errors.
 */
export function evaluateExpression(expr: string, ctx: EvalContext): number {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens, expr);
  const ast = parser.parse();
  const result = evaluateAST(ast, ctx);
  return toNum(result);
}

/**
 * Evaluate an expression and return the raw result (may be number, string, boolean, or null).
 * Useful for conditional expressions that return non-numeric values.
 */
export function evaluateExpressionRaw(expr: string, ctx: EvalContext): EvalResult {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens, expr);
  const ast = parser.parse();
  return evaluateAST(ast, ctx);
}
