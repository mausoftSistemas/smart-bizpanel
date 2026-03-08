// ─── Tipos de configuración ─────────────────────────────

export interface ErpEndpointConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  itemsPath?: string; // path al array en la respuesta (e.g. "value", "data.items")
  mappings: Record<string, string>; // { campoLocal: "campoErp" }
  itemsMappings?: Record<string, string>; // para sub-items (renglones de pedido, etc.)
}

export interface ErpMappingConfig {
  producto: ErpEndpointConfig;
  cliente: ErpEndpointConfig;
  precio: ErpEndpointConfig;
  stock: ErpEndpointConfig;
  cuentaCorriente: ErpEndpointConfig;
  pedido: ErpEndpointConfig;
  cobranza: ErpEndpointConfig;
  devolucion: ErpEndpointConfig;
}

export interface ErpConfig {
  baseUrl: string;
  companyDb?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  mapping?: ErpMappingConfig;
  [key: string]: unknown;
}

// ─── Tipos de datos ERP ─────────────────────────────────

export interface ErpProducto {
  erpId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  stock: number;
  unidad?: string;
  categoria?: string;
}

export interface ErpCliente {
  erpId: string;
  codigo: string;
  razonSocial: string;
  cuit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  listaPrecio?: string;
}

export interface ErpPrecio {
  productoErpId: string;
  clienteErpId?: string;
  listaPrecioId?: string;
  precio: number;
  moneda?: string;
  vigenciaDesde?: Date;
  vigenciaHasta?: Date;
}

export interface ErpStock {
  productoErpId: string;
  cantidad: number;
  deposito?: string;
}

export interface ErpCuentaCorrienteMovimiento {
  erpId: string;
  clienteErpId: string;
  tipoMovimiento: string;
  numero?: string;
  fecha: Date;
  fechaVencimiento?: Date;
  debe: number;
  haber: number;
  saldo: number;
}

export interface ErpPedido {
  erpId?: string;
  numero?: string;
  clienteErpId: string;
  items: { productoErpId: string; cantidad: number; precio: number; descuento?: number }[];
  observacion?: string;
}

export interface ErpCobranza {
  erpId?: string;
  clienteErpId: string;
  monto: number;
  medioPago: string;
  referencia?: string;
}

export interface ErpDevolucion {
  erpId?: string;
  clienteErpId: string;
  tipo: string;
  facturaNumero?: string;
  items: { productoErpId: string; cantidad: number; precio: number; motivo?: string }[];
  observacion?: string;
}

export interface ErpPushResult {
  erpId: string;
  status: string;
  numero?: string;
}

// ─── Interfaz del adaptador ─────────────────────────────

export interface ErpAdapter {
  readonly name: string;

  initialize(config: ErpConfig): Promise<void>;
  testConnection(): Promise<boolean>;

  // Pull desde ERP
  fetchProductos(since?: Date): Promise<ErpProducto[]>;
  fetchClientes(since?: Date): Promise<ErpCliente[]>;
  fetchPrecios(since?: Date): Promise<ErpPrecio[]>;
  fetchStock(): Promise<ErpStock[]>;
  fetchCuentaCorriente(clienteErpId: string): Promise<ErpCuentaCorrienteMovimiento[]>;

  // Push hacia ERP
  pushPedido(pedido: ErpPedido): Promise<ErpPushResult>;
  pushCobranza(cobranza: ErpCobranza): Promise<ErpPushResult>;
  pushDevolucion(devolucion: ErpDevolucion): Promise<ErpPushResult>;
}
