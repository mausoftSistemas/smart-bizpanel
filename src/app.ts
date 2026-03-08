import express from 'express';
import { corsMiddleware, helmetMiddleware, rateLimitMiddleware } from './middleware/security.middleware';
import { errorHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.routes';
import syncRoutes from './routes/sync.routes';
import productosRoutes from './routes/productos.routes';
import clientesRoutes from './routes/clientes.routes';
import pedidosRoutes from './routes/pedidos.routes';
import cobranzasRoutes from './routes/cobranzas.routes';
import devolucionesRoutes from './routes/devoluciones.routes';
import jornadasRoutes from './routes/jornadas.routes';
import gpsRoutes from './routes/gps.routes';
import configRoutes from './routes/config.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

// Confiar en el reverse proxy (EasyPanel, Nginx, etc.)
app.set('trust proxy', 1);

// ─── Global middleware ──────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/cobranzas', cobranzasRoutes);
app.use('/api/devoluciones', devolucionesRoutes);
app.use('/api/jornadas', jornadasRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// ─── Error handler (debe ir último) ────────────────────────
app.use(errorHandler);

export default app;
