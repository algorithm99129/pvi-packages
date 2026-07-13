import type { FormulaDef, FormulaValueType } from '@garden-siege/protocol';
import {
  FORMULA_VAR_HELPER,
  rewriteVarCalls,
  stripTypeScriptTypes,
  toFunctionName,
  tryEvaluateFormulaSource,
  type FormulaCallHelpers,
} from './compileFormula';

export interface FormulaValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export interface FormulaValidationResult {
  status: 'valid' | 'warning' | 'error';
  issues: FormulaValidationIssue[];
  testValue?: unknown;
  testError?: string;
}

export interface ValidateFormulaContext {
  formula: FormulaDef;
  formulas: FormulaDef[];
  variableIds: string[];
  resolveVariable?: (id: string) => unknown;
}

const VAR_REF = /var\s*\(\s*["']([^"']+)["']\s*\)/g;
const FORMULA_CALL = /formula\s*\(\s*["']([^"']+)["']\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;

function defaultTestValue(type: FormulaValueType): unknown {
  switch (type) {
    case 'boolean':
      return true;
    case 'string':
      return 'test';
    case 'object':
      return {};
    default:
      return 1;
  }
}

function buildTestInputs(formula: FormulaDef): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const port of formula.inputs) {
    values[port.name] =
      formula.testInputs && port.name in formula.testInputs
        ? formula.testInputs[port.name]
        : defaultTestValue(port.type);
  }
  return values;
}

function extractObjectKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  const keys: string[] = [];
  const keyRe = /["']?(\w+)["']?\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = keyRe.exec(raw)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function resolveFormulaRef(nameOrId: string, formulas: FormulaDef[], excludeId?: string): FormulaDef | undefined {
  return formulas.find(
    (f) =>
      f.id !== excludeId
      && (f.id === nameOrId || f.name === nameOrId || toFunctionName(f.name) === nameOrId),
  );
}

function matchesOutputType(value: unknown, outputType: FormulaValueType): boolean {
  switch (outputType) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}

function isKnownVariable(varId: string, knownVars: Set<string>): boolean {
  if (knownVars.has(varId)) return true;
  const parts = varId.split('.');
  for (let i = parts.length; i >= 1; i--) {
    if (knownVars.has(parts.slice(0, i).join('.'))) return true;
  }
  return false;
}

function collectVarRefs(source: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(VAR_REF.source, 'g');
  while ((match = re.exec(source)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function collectFormulaCalls(source: string): { name: string; argsRaw?: string }[] {
  const calls: { name: string; argsRaw?: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FORMULA_CALL.source, 'g');
  while ((match = re.exec(source)) !== null) {
    calls.push({ name: match[1], argsRaw: match[2] });
  }
  return calls;
}

function checkSyntax(source: string, formulaName: string, inputs: { name: string }[]): string | undefined {
  const fnName = toFunctionName(formulaName);
  const stripped = rewriteVarCalls(stripTypeScriptTypes(source.trim()));
  if (!stripped.includes(`function ${fnName}`) && !stripped.includes(`function ${fnName}(`)) {
    return `Expected a function named "${fnName}" (from formula name).`;
  }
  const argNames = inputs.map((i) => i.name);
  try {
    // eslint-disable-next-line no-new-func
    new Function(FORMULA_VAR_HELPER, 'formula', ...argNames, stripped);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function createFormulaHelpers(ctx: ValidateFormulaContext, memo: Map<string, unknown>): FormulaCallHelpers {
  const resolveVar =
    ctx.resolveVariable
    ?? ((id: string) => {
      if (ctx.variableIds.includes(id)) return 1;
      return 0;
    });

  return {
    var: resolveVar,
    formula: (idOrName: string, args: Record<string, unknown> = {}) => {
      const target = resolveFormulaRef(idOrName, ctx.formulas, ctx.formula.id);
      if (!target) return 0;
      if (memo.has(target.id)) return memo.get(target.id);
      const nested = validateAndRunFormula({ ...ctx, formula: target }, args, memo, false);
      return nested.testValue ?? 0;
    },
  };
}

function validateAndRunFormula(
  ctx: ValidateFormulaContext,
  overrideInputs: Record<string, unknown> | undefined,
  memo: Map<string, unknown>,
  collectIssues: boolean,
): FormulaValidationResult {
  const { formula } = ctx;
  const issues: FormulaValidationIssue[] = [];
  const source = formula.source?.trim() ?? '';

  if (!source) {
    return {
      status: 'error',
      issues: [{ level: 'error', message: 'Formula source is empty.' }],
    };
  }

  const syntaxError = checkSyntax(source, formula.name, formula.inputs);
  if (syntaxError) {
    issues.push({ level: 'error', message: `Syntax error: ${syntaxError}` });
  }

  const knownVars = new Set(ctx.variableIds);
  for (const varId of collectVarRefs(source)) {
    if (!isKnownVariable(varId, knownVars)) {
      issues.push({ level: 'error', message: `Unknown variable "${varId}".` });
    }
  }

  for (const call of collectFormulaCalls(source)) {
    const target = resolveFormulaRef(call.name, ctx.formulas, formula.id);
    if (!target) {
      issues.push({ level: 'error', message: `Unknown formula "${call.name}".` });
      continue;
    }
    const passedKeys = extractObjectKeys(call.argsRaw);
    const required = target.inputs.map((i) => i.name);
    const missing = required.filter((k) => !passedKeys.includes(k));
    if (missing.length > 0) {
      issues.push({
        level: 'error',
        message: `Formula "${call.name}" expects input(s): ${missing.join(', ')}.`,
      });
    }
    if (required.length > 0 && passedKeys.length === 0 && !call.argsRaw) {
      issues.push({
        level: 'error',
        message: `Formula "${call.name}" requires inputs: ${required.join(', ')}.`,
      });
    }
  }

  const testInputs = { ...buildTestInputs(formula), ...overrideInputs };
  const helpers = createFormulaHelpers(ctx, memo);

  let testValue: unknown;
  let testError: string | undefined;
  const run = tryEvaluateFormulaSource(source, formula.name, formula.inputs, helpers, testInputs);
  if (run.ok) {
    testValue = run.value;
    memo.set(formula.id, testValue);
    if (!matchesOutputType(testValue, formula.outputType)) {
      issues.push({
        level: 'error',
        message: `Return value is ${typeof testValue}, expected ${formula.outputType}.`,
      });
    }
  } else {
    testError = run.error;
    if (collectIssues) {
      issues.push({ level: 'error', message: `Runtime error: ${testError}` });
    }
  }

  const hasError = issues.some((i) => i.level === 'error') || Boolean(testError);
  const hasWarning = issues.some((i) => i.level === 'warning');

  return {
    status: hasError ? 'error' : hasWarning ? 'warning' : 'valid',
    issues,
    testValue,
    testError,
  };
}

export function validateFormula(ctx: ValidateFormulaContext): FormulaValidationResult {
  return validateAndRunFormula(ctx, undefined, new Map(), true);
}

export function validateAllFormulas(
  formulas: FormulaDef[],
  variableIds: string[],
  resolveVariable?: (id: string) => unknown,
): Map<string, FormulaValidationResult> {
  const results = new Map<string, FormulaValidationResult>();
  for (const formula of formulas) {
    results.set(
      formula.id,
      validateFormula({ formula, formulas, variableIds, resolveVariable }),
    );
  }
  return results;
}
