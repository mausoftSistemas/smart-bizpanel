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
import defaultMapping from '../mappings/sap-b1.mapping.json';
import { logger } from '../../utils/logger';

export class SapB1Adapter implements ErpAdapter {
  readonly name = 'sap-b1';
  private config!: ErpConfig;
  private http!: AxiosInstance;
  private sessionId?: string;
  private mappingConfig!: ErpMappingConfig;

  async initialize(config: ErpConfig): Promise<void> {
    this.config = config;
    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });
    this.mappingConfig = (config.mapping || defaultMapping) as ErpMappingConfig;
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    const res = await this.http.post('/Login', {
      CompanyDB: this.config.companyDb,
      UserName: this.config.username,
      Password: this.config.password,
    });
    this.sessionId = res.data.SessionId;
    this.http.defaults.headers.common['Cookie'] = `B1SESSION=${this.sessionId}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      this.sessionId = undefined;
      await this.ensureSession();
      return true;
    } catch (err) {
      logger.error('SAP B1 connection test failed', err);
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
    await this.ensureSession();
    const entityConfig = this.getEntityConfig(entityType);
    const mapper = new FieldMapper(entityConfig.mappings);
    let url = entityConfig.endpoint;
    if (queryParams) url += (url.includes('?') ? '&' : '?') + queryParams;

    const res = await this.http.get(url);
    const items = this.extractItems(res.data, entityConfig.itemsPath);
    return mapper.mapArrayFromErp<T>(items);
  }

  private async pushEntity(entityType: keyof ErpMappingConfig, data: Record<string, unknown>): Promise<ErpPushResult> {
    await this.ensureSession();
    const entityConfig = this.getEntityConfig(entityType);
    const mapper = new FieldMapper(entityConfig.mappings);
    const body = mapper.mapToErp(data);

    const res = await this.http.post(entityConfig.endpoint, body);
    return {
      erpId: String(res.data.DocEntry || res.data.id || ''),
      status: 'ok',
      numero: res.data.DocNum ? String(res.data.DocNum) : undefined,
    };
  }

  // ─── Pull ─────────────────────────────────────────────

  async fetchProductos(since?: Date): Promise<ErpProducto[]> {
    let query = '$select=ItemCode,ItemName,ItemPrices,QuantityOnStock,SalesUnit,ItemsGroupCode';
    if (since) {
      query += `&$filter=UpdateDate ge '${since.toISOString().split('T')[0]}'`;
    }
    return this.fetchEntity<ErpProducto>('producto', query);
  }

  async fetchClientes(since?: Date): Promise<ErpCliente[]> {
    let query = "$filter=CardType eq 'C'";
    if (since) {
      query += ` and UpdateDate ge '${since.toISOString().split('T')[0]}'`;
    }
    return this.fetchEntity<ErpCliente>('cliente', query);
  }

  async fetchPrecios(since?: Date): Promise<ErpPrecio[]> {
    let query = '';
    if (since) {
      query = `$filter=UpdateDate ge '${since.toISOString().split('T')[0]}'`;
    }
    return this.fetchEntity<ErpPrecio>('precio', query || undefined);
  }

  async fetchStock(): Promise<ErpStock[]> {
    return this.fetchEntity<ErpStock>('stock', '$select=ItemCode,QuantityOnStock,DefaultWarehouse');
  }

  async fetchCuentaCorriente(clienteErpId: string): Promise<ErpCuentaCorrienteMovimiento[]> {
    const query = `$filter=ShortName eq '${clienteErpId}'`;
    return this.fetchEntity<ErpCuentaCorrienteMovimiento>('cuentaCorriente', query);
  }

  // ─── Push ─────────────────────────────────────────────

  async pushPedido(pedido: ErpPedido): Promise<ErpPushResult> {
    const entityConfig = this.getEntityConfig('pedido');
    const mapper = new FieldMapper(entityConfig.mappings);

    await this.ensureSession();
    const body = mapper.mapToErp(pedido as unknown as Record<string, unknown>);

    // Mapear items con itemsMappings
    if (pedido.items && entityConfig.itemsMappings) {
      const itemMapper = new FieldMapper(entityConfig.itemsMappings);
      body['DocumentLines'] = itemMapper.mapArrayToErp(
        pedido.items as unknown as Record<string, unknown>[]
      );
    }

    const res = await this.http.post(entityConfig.endpoint, body);
    return {
      erpId: String(res.data.DocEntry),
      status: 'ok',
      numero: res.data.DocNum ? String(res.data.DocNum) : undefined,
    };
  }

  async pushCobranza(cobranza: ErpCobranza): Promise<ErpPushResult> {
    return this.pushEntity('cobranza', cobranza as unknown as Record<string, unknown>);
  }

  async pushDevolucion(devolucion: ErpDevolucion): Promise<ErpPushResult> {
    const entityConfig = this.getEntityConfig('devolucion');
    const mapper = new FieldMapper(entityConfig.mappings);

    await this.ensureSession();
    const body = mapper.mapToErp(devolucion as unknown as Record<string, unknown>);

    if (devolucion.items && entityConfig.itemsMappings) {
      const itemMapper = new FieldMapper(entityConfig.itemsMappings);
      body['DocumentLines'] = itemMapper.mapArrayToErp(
        devolucion.items as unknown as Record<string, unknown>[]
      );
    }

    const res = await this.http.post(entityConfig.endpoint, body);
    return {
      erpId: String(res.data.DocEntry),
      status: 'ok',
      numero: res.data.DocNum ? String(res.data.DocNum) : undefined,
    };
  }
}
