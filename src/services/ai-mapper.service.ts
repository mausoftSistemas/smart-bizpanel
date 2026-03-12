import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ENTITY_TEMPLATES } from './import.service';

const prisma = new PrismaClient();

// ─── Tipos ─────────────────────────────────────────────

export interface AutoMapResult {
  source: 'saved' | 'similar' | 'ai' | 'none';
  mapping: Record<string, string>; // { campoSistema: columnaArchivo }
  defaultValues?: Record<string, string>;
  confidence: number;
  savedMappingId?: string;
  nombre?: string;
  notas?: string;
}

// ─── Huella digital de columnas ─────────────────────────

export function calcularHuella(columns: string[]): string {
  const normalized = columns.map((c) => c.toLowerCase().trim()).sort().join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ─── Buscar mapeo exacto (mismas columnas) ──────────────

async function buscarMapeoExacto(
  tenantId: string,
  entityType: string,
  huella: string,
): Promise<AutoMapResult | null> {
  const found = await prisma.mappingGuardado.findUnique({
    where: { tenantId_entityType_huella: { tenantId, entityType, huella } },
  });

  if (!found) return null;

  // Incrementar contador de uso
  await prisma.mappingGuardado.update({
    where: { id: found.id },
    data: { vecesUsado: { increment: 1 } },
  });

  return {
    source: 'saved',
    mapping: found.mapping as Record<string, string>,
    defaultValues: (found.defaultValues as Record<string, string>) || undefined,
    confidence: 1.0,
    savedMappingId: found.id,
    nombre: found.nombre,
  };
}

// ─── Buscar mapeo similar (overlap >= 80%) ──────────────

async function buscarMapeoSimilar(
  tenantId: string,
  entityType: string,
  columns: string[],
): Promise<AutoMapResult | null> {
  const candidates = await prisma.mappingGuardado.findMany({
    where: { tenantId, entityType, confirmado: true },
    orderBy: { vecesUsado: 'desc' },
    take: 20,
  });

  if (candidates.length === 0) return null;

  const colsLower = new Set(columns.map((c) => c.toLowerCase().trim()));

  let bestCandidate: (typeof candidates)[number] | null = null;
  let bestOverlap = 0;

  for (const candidate of candidates) {
    const savedCols = (candidate.columnasArchivo as string[]).map((c) => c.toLowerCase().trim());
    const intersection = savedCols.filter((c) => colsLower.has(c)).length;
    const overlap = intersection / Math.max(savedCols.length, colsLower.size);

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate || bestOverlap < 0.8) return null;

  // Adaptar mapping: solo incluir columnas que existen en el archivo actual
  const savedMapping = bestCandidate.mapping as Record<string, string>;
  const adaptedMapping: Record<string, string> = {};
  const colsLowerMap = new Map(columns.map((c) => [c.toLowerCase().trim(), c]));

  for (const [campo, columna] of Object.entries(savedMapping)) {
    const match = colsLowerMap.get(columna.toLowerCase().trim());
    if (match) {
      adaptedMapping[campo] = match;
    }
  }

  if (Object.keys(adaptedMapping).length === 0) return null;

  return {
    source: 'similar',
    mapping: adaptedMapping,
    defaultValues: (bestCandidate.defaultValues as Record<string, string>) || undefined,
    confidence: Math.round(bestOverlap * 100) / 100,
    savedMappingId: bestCandidate.id,
    nombre: bestCandidate.nombre,
    notas: `Basado en mapeo "${bestCandidate.nombre}" (${Math.round(bestOverlap * 100)}% coincidencia)`,
  };
}

// ─── Sugerir con IA (OpenAI) ────────────────────────────

async function sugerirConIA(
  entityType: string,
  columns: string[],
  sampleData?: Record<string, unknown>[],
): Promise<AutoMapResult | null> {
  if (!env.OPENAI_API_KEY) return null;

  const template = ENTITY_TEMPLATES[entityType];
  if (!template) return null;

  const sampleText = sampleData && sampleData.length > 0
    ? `\n\nDatos de ejemplo (primeras ${Math.min(sampleData.length, 3)} filas):\n${JSON.stringify(sampleData.slice(0, 3), null, 2)}`
    : '';

  const prompt = `Sos un experto en mapeo de datos para importaciones.

Campos del sistema para "${entityType}":
${template.columns.map((c) => `- ${c}${template.required.includes(c) ? ' (obligatorio)' : ''}`).join('\n')}

Columnas del archivo del usuario:
${columns.map((c) => `- "${c}"`).join('\n')}
${sampleText}

Respondé SOLO con un JSON válido con esta estructura:
{
  "mapping": { "campoSistema": "columnaArchivo" },
  "confidence": 0.85,
  "notas": "explicación breve"
}

Reglas:
- Solo mapeá columnas que realmente coincidan semánticamente
- Los valores de "mapping" DEBEN ser exactamente una de las columnas del archivo listadas arriba
- Las claves de "mapping" DEBEN ser campos del sistema listados arriba
- confidence entre 0 y 1
- Si no hay coincidencias claras, retorná mapping vacío con confidence 0`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.mapping || typeof parsed.mapping !== 'object') return null;

    // Validar: solo aceptar columnas que realmente existen y campos válidos
    const validFields = new Set(template.columns);
    const validColumns = new Set(columns);
    const validatedMapping: Record<string, string> = {};

    for (const [campo, columna] of Object.entries(parsed.mapping)) {
      if (validFields.has(campo) && typeof columna === 'string' && validColumns.has(columna)) {
        validatedMapping[campo] = columna;
      }
    }

    if (Object.keys(validatedMapping).length === 0) return null;

    return {
      source: 'ai',
      mapping: validatedMapping,
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0.7, 0), 1),
      notas: parsed.notas || 'Sugerencia generada por IA',
    };
  } catch (err) {
    logger.warn('AI mapper falló', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Guardar mapeo ──────────────────────────────────────

export async function guardarMapeo(
  tenantId: string,
  entityType: string,
  nombre: string,
  columnasArchivo: string[],
  mapping: Record<string, string>,
  defaultValues?: Record<string, string>,
  opciones?: Record<string, unknown>,
): Promise<{ id: string }> {
  const huella = calcularHuella(columnasArchivo);

  const result = await prisma.mappingGuardado.upsert({
    where: { tenantId_entityType_huella: { tenantId, entityType, huella } },
    update: {
      nombre,
      columnasArchivo: columnasArchivo as unknown as import('@prisma/client').Prisma.InputJsonValue,
      mapping: mapping as unknown as import('@prisma/client').Prisma.InputJsonValue,
      defaultValues: defaultValues ? (defaultValues as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      opciones: opciones ? (opciones as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      vecesUsado: { increment: 1 },
      confirmado: true,
      creadoPorIA: false,
    },
    create: {
      tenantId,
      entityType,
      nombre,
      columnasArchivo: columnasArchivo as unknown as import('@prisma/client').Prisma.InputJsonValue,
      huella,
      mapping: mapping as unknown as import('@prisma/client').Prisma.InputJsonValue,
      defaultValues: defaultValues ? (defaultValues as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      opciones: opciones ? (opciones as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      creadoPorIA: false,
      confirmado: true,
    },
  });

  return { id: result.id };
}

// ─── Orquestador: auto-map ──────────────────────────────

export async function autoMap(
  tenantId: string,
  entityType: string,
  columns: string[],
  sampleData?: Record<string, unknown>[],
): Promise<AutoMapResult> {
  const huella = calcularHuella(columns);

  // 1. Buscar mapeo exacto guardado
  const exact = await buscarMapeoExacto(tenantId, entityType, huella);
  if (exact) return exact;

  // 2. Buscar mapeo similar
  const similar = await buscarMapeoSimilar(tenantId, entityType, columns);
  if (similar) return similar;

  // 3. Intentar IA (solo si hay API key)
  const ai = await sugerirConIA(entityType, columns, sampleData);
  if (ai) return ai;

  // 4. Sin resultado
  return {
    source: 'none',
    mapping: {},
    confidence: 0,
  };
}
