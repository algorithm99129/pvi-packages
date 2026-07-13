import type { FormulaDef, VariableDef } from '@garden-siege/protocol';
import { toFunctionName, tryEvaluateFormulaSource } from './compileFormula';

const UNRESOLVED = Symbol('unresolved');

export interface FormulaRuntimeContext {
  inputs: Record<string, unknown>;
  formulas: FormulaDef[];
  variables: VariableDef[];
  memo?: Map<string, unknown>;
}

function walkObjectPath(value: unknown, segments: string[]): unknown {
  let current = value;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return 0;
    current = (current as Record<string, unknown>)[seg];
  }
  return current ?? 0;
}

function resolveExactVariable(id: string, ctx: FormulaRuntimeContext): unknown | typeof UNRESOLVED {
  const custom = ctx.variables.find((v) => v.id === id);
  if (custom) {
    if (custom.source === 'constant') return custom.constantValue;
    if (custom.source === 'formula' && custom.formulaId) {
      return evaluateFormulaById(custom.formulaId, ctx, {});
    }
    return UNRESOLVED;
  }
  return UNRESOLVED;
}

export function resolveVariable(id: string, ctx: FormulaRuntimeContext): unknown {
  const memo = ctx.memo ?? new Map<string, unknown>();
  if (memo.has(id)) return memo.get(id);

  const exact = resolveExactVariable(id, ctx);
  if (exact !== UNRESOLVED) {
    memo.set(id, exact);
    return exact;
  }

  const lastDot = id.lastIndexOf('.');
  if (lastDot > 0) {
    const parentId = id.slice(0, lastDot);
    const leaf = id.slice(lastDot + 1);
    const parent = resolveVariable(parentId, ctx);
    const value = walkObjectPath(parent, [leaf]);
    memo.set(id, value);
    return value;
  }

  memo.set(id, 0);
  return 0;
}

function formulaHelpers(ctx: FormulaRuntimeContext, memo: Map<string, unknown>) {
  return {
    var: (key: string) => resolveVariable(key, ctx),
    formula: (idOrName: string, args: Record<string, unknown> = {}) => {
      const target =
        ctx.formulas.find((f) => f.id === idOrName)
        ?? ctx.formulas.find((f) => f.name === idOrName)
        ?? ctx.formulas.find((f) => toFunctionName(f.name) === idOrName);
      if (!target) return 0;
      return evaluateFormula(target, { ...ctx, inputs: { ...ctx.inputs, ...args }, memo });
    },
  };
}

export function evaluateFormulaById(
  formulaId: string,
  ctx: FormulaRuntimeContext,
  inputs: Record<string, unknown>,
): unknown {
  const formula = ctx.formulas.find((f) => f.id === formulaId);
  if (!formula) return 0;
  return evaluateFormula(formula, { ...ctx, inputs: { ...ctx.inputs, ...inputs } });
}

export function evaluateFormula(formula: FormulaDef, ctx: FormulaRuntimeContext): unknown {
  const memo = ctx.memo ?? new Map<string, unknown>();
  const helpers = formulaHelpers(ctx, memo);
  const inputValues = { ...ctx.inputs };

  if (formula.source?.trim()) {
    const result = tryEvaluateFormulaSource(
      formula.source,
      formula.name,
      formula.inputs,
      helpers,
      inputValues,
    );
    return result.ok ? result.value : 0;
  }

  return 0;
}
