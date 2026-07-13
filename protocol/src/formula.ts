export type FormulaValueType = 'number' | 'boolean' | 'string' | 'object';

export interface FormulaInputPort {
  name: string;
  type: FormulaValueType;
}

export interface FormulaDef {
  id: string;
  name: string;
  description?: string;
  inputs: FormulaInputPort[];
  outputType: FormulaValueType;
  /** TypeScript function source — function name is derived from `name`. */
  source?: string;
  testInputs?: Record<string, unknown>;
  validationStatus?: 'valid' | 'warning' | 'error';
}

export type VariableSource = 'constant' | 'formula';

export type VariableValueType = 'number' | 'string' | 'object';

export interface VariableDef {
  id: string;
  name: string;
  type: VariableValueType;
  source: VariableSource;
  description?: string;
  constantValue?: unknown;
  formulaId?: string;
}

export interface LogicSystemConfig {
  formulas: FormulaDef[];
  variables: VariableDef[];
}

export function defaultLogicSystem(): LogicSystemConfig {
  return { formulas: [], variables: [] };
}
