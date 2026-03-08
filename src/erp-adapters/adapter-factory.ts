import { ErpAdapter, ErpConfig, ErpMappingConfig } from './erp-adapter.interface';
import { StandaloneAdapter } from './adapters/standalone.adapter';
import { SapB1Adapter } from './adapters/sap-b1.adapter';
import { TangoAdapter } from './adapters/tango.adapter';
import { GenericRestAdapter } from './adapters/generic-rest.adapter';
import sapMapping from './mappings/sap-b1.mapping.json';
import tangoMapping from './mappings/tango.mapping.json';

const adapterMap: Record<string, new () => ErpAdapter> = {
  standalone: StandaloneAdapter,
  sap_b1: SapB1Adapter,
  tango: TangoAdapter,
  custom: GenericRestAdapter,
};

const defaultMappings: Record<string, ErpMappingConfig> = {
  sap_b1: sapMapping as unknown as ErpMappingConfig,
  tango: tangoMapping as unknown as ErpMappingConfig,
};

interface TenantLike {
  erpTipo: string;
  erpUrl?: string | null;
  erpCredenciales?: unknown;
  erpMapping?: unknown;
}

/**
 * Crea e inicializa un adapter ERP a partir de los datos del tenant.
 * Función asíncrona: instancia el adapter, construye ErpConfig, llama initialize().
 */
export async function createAdapter(tenant: TenantLike): Promise<ErpAdapter> {
  const AdapterClass = adapterMap[tenant.erpTipo];
  if (!AdapterClass) {
    throw new Error(`ERP adapter no encontrado: ${tenant.erpTipo}`);
  }

  const adapter = new AdapterClass();

  const config: ErpConfig = {
    baseUrl: tenant.erpUrl || '',
    ...((tenant.erpCredenciales as object) || {}),
    mapping: (tenant.erpMapping as ErpMappingConfig) || defaultMappings[tenant.erpTipo] || undefined,
  };

  await adapter.initialize(config);
  return adapter;
}

/** @deprecated Usar createAdapter(tenant) en su lugar */
export function createErpAdapter(erpTipo: string, erpConfig: unknown): ErpAdapter {
  const AdapterClass = adapterMap[erpTipo];
  if (!AdapterClass) {
    throw new Error(`ERP adapter no encontrado: ${erpTipo}`);
  }
  // Compatibilidad: no llama initialize(), solo instancia
  return new AdapterClass();
}
