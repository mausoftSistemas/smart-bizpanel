// ─── Legacy format (arrays de {source, target}) ────────

export interface FieldMapping {
  source: string;
  target: string;
  transform?: 'string' | 'number' | 'date' | 'boolean';
}

export interface EntityMapping {
  entity: string;
  fields: FieldMapping[];
}

export function mapFields<T>(
  source: Record<string, unknown>,
  fields: FieldMapping[]
): T {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    let value = source[field.source];
    if (value === undefined) continue;

    switch (field.transform) {
      case 'number':
        value = Number(value);
        break;
      case 'string':
        value = String(value);
        break;
      case 'date':
        value = new Date(value as string);
        break;
      case 'boolean':
        value = Boolean(value);
        break;
    }

    result[field.target] = value;
  }

  return result as T;
}

// ─── Nueva clase FieldMapper (formato objeto { local: "erp" }) ──

/**
 * Mapeo bidireccional de campos.
 * El mapping se define como { campoLocal: "campoErp" }.
 * - mapFromErp(): invierte key↔value para convertir datos ERP → local
 * - mapToErp(): convierte datos locales → ERP directamente
 */
export class FieldMapper {
  constructor(private mappings: Record<string, string>) {}

  /** Convierte datos del ERP al formato local */
  mapFromErp<T = Record<string, unknown>>(erpData: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    // Invertir: buscar qué campo local tiene valor erpField que coincida con la key del dato
    for (const [localField, erpField] of Object.entries(this.mappings)) {
      const value = erpData[erpField];
      if (value !== undefined) {
        result[localField] = value;
      }
    }
    return result as T;
  }

  /** Convierte datos locales al formato del ERP */
  mapToErp(localData: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [localField, erpField] of Object.entries(this.mappings)) {
      const value = localData[localField];
      if (value !== undefined) {
        result[erpField] = value;
      }
    }
    return result;
  }

  /** Mapea un array de objetos desde el ERP */
  mapArrayFromErp<T = Record<string, unknown>>(erpArray: Record<string, unknown>[]): T[] {
    return erpArray.map((item) => this.mapFromErp<T>(item));
  }

  /** Mapea un array de objetos hacia el ERP */
  mapArrayToErp(localArray: Record<string, unknown>[]): Record<string, unknown>[] {
    return localArray.map((item) => this.mapToErp(item));
  }
}
