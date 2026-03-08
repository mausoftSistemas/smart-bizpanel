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
} from '../erp-adapter.interface';

export class StandaloneAdapter implements ErpAdapter {
  readonly name = 'standalone';

  async initialize(_config: ErpConfig): Promise<void> {
    // No-op: no hay ERP externo
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  // Pull — en modo standalone no hay ERP externo; los datos viven en la BD local
  async fetchProductos(_since?: Date): Promise<ErpProducto[]> {
    return [];
  }

  async fetchClientes(_since?: Date): Promise<ErpCliente[]> {
    return [];
  }

  async fetchPrecios(_since?: Date): Promise<ErpPrecio[]> {
    return [];
  }

  async fetchStock(): Promise<ErpStock[]> {
    return [];
  }

  async fetchCuentaCorriente(_clienteErpId: string): Promise<ErpCuentaCorrienteMovimiento[]> {
    return [];
  }

  // Push — el registro ya fue guardado en la BD local
  async pushPedido(_pedido: ErpPedido): Promise<ErpPushResult> {
    return { erpId: `local-${Date.now()}`, status: 'ok' };
  }

  async pushCobranza(_cobranza: ErpCobranza): Promise<ErpPushResult> {
    return { erpId: `local-${Date.now()}`, status: 'ok' };
  }

  async pushDevolucion(_devolucion: ErpDevolucion): Promise<ErpPushResult> {
    return { erpId: `local-${Date.now()}`, status: 'ok' };
  }
}
