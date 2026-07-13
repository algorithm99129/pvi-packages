import type { FormulaInputPort } from '@garden-siege/protocol';
import { evaluateExpression } from './evaluate';

export const FORMULA_VAR_HELPER = '$var';

export function rewriteVarCalls(source: string): string {
  return source.replace(/\bvar\s*\(/g, `${FORMULA_VAR_HELPER}(`);
}

export function stripTypeScriptTypes(source: string): string {
  return source
    .replace(/:\s*(number|string|boolean|object|void|unknown|any)(\[\])?/g, '')
    .replace(/:\s*Record<[^>]+>/g, '');
}

export function toFunctionName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'formula';
  const [first, ...rest] = parts;
  const head = first.replace(/^[^a-zA-Z_$]+/, '') || 'formula';
  const tail = rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return head.charAt(0).toLowerCase() + head.slice(1) + tail;
}

export function formulaSourceTemplate(
  name: string,
  inputs: FormulaInputPort[],
  outputType: string,
): string {
  const fn = toFunctionName(name);
  const tsType = (t: string) => (t === 'object' ? 'Record<string, unknown>' : t);
  const params = inputs.map((i) => `${i.name}: ${tsType(i.type)}`).join(', ');
  return `function ${fn}(${params}): ${tsType(outputType)} {\n  return 0\n}`;
}

export interface FormulaCallHelpers {
  var: (key: string) => unknown;
  formula: (idOrName: string, args?: Record<string, unknown>) => unknown;
}

export function evaluateFormulaSource(
  source: string,
  formulaName: string,
  inputs: FormulaInputPort[],
  helpers: FormulaCallHelpers,
  inputValues: Record<string, unknown>,
): unknown {
  const result = tryEvaluateFormulaSource(source, formulaName, inputs, helpers, inputValues);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export function tryEvaluateFormulaSource(
  source: string,
  formulaName: string,
  inputs: FormulaInputPort[],
  helpers: FormulaCallHelpers,
  inputValues: Record<string, unknown>,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = source.trim();
  if (!trimmed) return { ok: false, error: 'Formula source is empty' };

  const fnName = toFunctionName(formulaName);
  const stripped = rewriteVarCalls(stripTypeScriptTypes(trimmed));
  const argNames = inputs.map((i) => i.name);
  const argValues = argNames.map((n) => inputValues[n] ?? 0);

  try {
    const runner = new Function(
      FORMULA_VAR_HELPER,
      'formula',
      ...argNames,
      `${stripped}\nreturn typeof ${fnName} === 'function' ? ${fnName}(${argNames.join(', ')}) : 0;`,
    );
    const value = runner(helpers.var, helpers.formula, ...argValues);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function evaluateLegacyExpression(
  expression: string,
  helpers: FormulaCallHelpers,
  inputValues: Record<string, unknown>,
): unknown {
  if (!expression.trim()) return 0;
  return evaluateExpression(expression, {
    inputs: inputValues,
    resolveVar: helpers.var,
  });
}
