export interface ExpressionContext {
  inputs: Record<string, unknown>;
  resolveVar: (key: string) => unknown;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pick(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '') return Number(value) || 0;
  return 0;
}

const FORMULA_VAR_HELPER = '$var';

function rewriteVarCalls(source: string): string {
  return source.replace(/\bvar\s*\(/g, `${FORMULA_VAR_HELPER}(`);
}

export function evaluateExpression(expression: string, ctx: ExpressionContext): unknown {
  const varFn = (key: string) => pick(ctx.resolveVar(key));
  const inputs = new Proxy(ctx.inputs, {
    get(target, prop: string) {
      return pick(target[prop]);
    },
  });

  const body = rewriteVarCalls(expression);
  const fn = new Function(
    'inputs',
    FORMULA_VAR_HELPER,
    'min',
    'max',
    'floor',
    'ceil',
    'round',
    'abs',
    'clamp',
    'if',
    `"use strict"; return (${body});`,
  );

  return fn(
    inputs,
    varFn,
    Math.min,
    Math.max,
    Math.floor,
    Math.ceil,
    Math.round,
    Math.abs,
    clamp,
    (cond: unknown, thenValue: unknown, elseValue: unknown) => (cond ? thenValue : elseValue),
  );
}
