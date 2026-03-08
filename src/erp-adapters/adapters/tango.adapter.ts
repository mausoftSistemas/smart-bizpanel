import axios, { AxiosInstance } from 'axios';
import {
  ErpAdapter,
  ErpConfig,
  ErpProducto,
  ErpCliente,
  ErpPrecio,
  ErpStock,
  ErpCuentaCorrienteMovimiento,
  ErpPedido,
  ErpCobranza,
  ErpDevolucion,
  ErpPushResult,
  ErpMappingConfig,
  ErpEndpointConfig,
} from '../erp-adapter.interface';
import { FieldMapper } from '../field-mapper';
import defaultMapping from '../mappings/tango.mapping.json';
import { logger } from '../../utils/logger';

export class TangoAdapter implements ErpAdapter {
  readonly name = 'tango';
  private config!: ErpConfig;
  private http!: AxiosInstance;
  private mappingConfig!: ErpMappingConfig;

  async initialize(config: ErpConfig): Promise<void> {
    this.config = config;
    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
    this.mappingConfig = (config.mapping || defaultMapping) as ErpMappingConfig;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.http.get('/api/health');
      return true;
    } catch (err) {
      logger.error('Tango connection test failed', err);
      return false;
    }
  }

  // ─── Helpers genéricos ────────────────────────────────

  private getEntityConfig(entityType: keyof ErpMappingConfig): ErpEndpointConfig {
    return this.mappingConfig[entityType];
  }

  private extractItems(responseData: unknown, itemsPath?: string): Record<string, unknown>[] {
    if (!itemsPath) return Array.isArray(responseData) ? responseData : [];
    const parts = itemsPath.split('.');
    let data: unknown = responseData;
    for (const part of parts) {
      data = (data as Record<string, unknown>)?.[part];
    }
    return Array.isArray(data) ? data : [];
  }

  private async fetchEntity<T>(entityType: keyof ErpMappingConfig, queryParams?: string): Promise<T[]> {
    const entityConfig = this.getEntityConfig(entityType);
    const mapper = new FieldMapper(entityConfig.mappings);
    let url = entityConfig.endpoint;
    if (queryParams) url += (url.includes('?') ? '&' : '?') + queryParams;

    const res = await this.http.get(url);
    const items = this.extractItems(res.data, entityConfig.itemsPath);
    return mapper.mapArrayFromErp<T>(items);
  }

  private async pushEntity(
    entityType: keyof ErpMappingConfig,
    data: Record<string, unknown>,
    items?: Record<string, unknown>[]
  ): Promise<ErpPushResult> {
    const entityConfig = this.getEntityConfig(entityType);
    const mapper = new FieldMapper(entityConfig.mappings);
    const body = mapper.mapToErp(data);

    if (items && entityConfig.itemsMappings) {
      const itemMapper = new FieldMapper(entityConfig.itemsMappings);
      body['renglones'] = itemMapper.mapArrayToErp(items);
    }

    const res = await this.http.post(entityConfig.endpoint, body);
    return {
      erpId: String(res.data.id || ''),
      status: 'ok',
      numero: res.data.numero ? String(res.data.numero) : undefined,
    };
  }

  // ─── Pull ─────────────────────────────────────────────

  async fetchProductos(_since?: Date): Promise<ErpProducto[]> {
    return this.fetchEntity<ErpProducto>('producto');
  }

  async fetchClientes(_since?: Date): Promise<ErpCliente[]> {
    return this.fetchEntity<ErpCliente>('cliente');
  }

  async fetchPrecios(_since?: Date): Promise<ErpPrecio[]> {
    return this.fetchEntity<ErpPrecio>('precio');
  }

  async fetchStock(): Promise<ErpStock[]> {
    return this.fetchEntity<ErpStock>('stock');
  }

  async fetchCuentaCorriente(clienteErpId: string): Promise<ErpCuentaCorrienteMovimiento[]> {
    return this.fetchEntity<ErpCuentaCorrienteMovimiento>(
      'cuentaCorriente',
      `cod_cliente=${clienteErpId}`
    );
  }

  // ─── Push ─────────────────────────────────────────────

  async pushPedido(pedido: ErpPedido): Promise<ErpPushResult> {
    return this.pushEntity(
      'pedido',
      pedido as unknown as Record<string, unknown>,
      pedido.items as unknown as Record<string, unknown>[]
    );
  }

  async pushCobranza(cobranza: ErpCobranza): Promise<ErpPushResult> {
    return this.pushEntity('cobranza', cobranza as unknown as Record<string, unknown>);
  }

  async pushDevolucion(devolucion: ErpDevolucion): Promise<ErpPushResult> {
    return this.pushEntity(
      'devolucion',
      devolucion as unknown as Record<string, unknown>,
      devolucion.items as unknown as Record<string, unknown>[]
    );
  }
}
