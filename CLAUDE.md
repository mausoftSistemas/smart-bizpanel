# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev          # Dev server with hot reload (ts-node-dev)
npm run build        # Compile TypeScript → dist/
npm run start        # Run compiled JS from dist/
npm run db:migrate   # Run Prisma migrations
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:seed      # Seed database
npx tsc --noEmit     # Type-check without emitting (no test framework yet)
```

Requires PostgreSQL running (use `docker-compose up db` or local instance). Copy `.env.example` to `.env` before first run.

## Architecture

**BizVentas API** — Multi-tenant Express REST API that bridges a Flutter mobile app with various ERPs (SAP B1, Tango, or standalone mode).

### Request Flow

All routes under `/api/*`. Auth routes are public; everything else goes through:
`authMiddleware` (JWT → `req.user`) → `tenantMiddleware` (ensures tenantId) → route handler

JWT payload: `{ userId, tenantId, rol }`. Role checks via `requireRole('admin')`. The `req.user` type is globally augmented on `Express.Request` in `auth.middleware.ts`.

### ERP Adapter Pattern

The core abstraction is in `src/erp-adapters/`:
- `ErpAdapter` interface defines pull (getProductos/getClientes) and push (createPedido/createCobranza) operations
- `adapter-factory.ts` maps tenant's `erpType` string → adapter class
- Each adapter in `adapters/` implements the interface for a specific ERP
- `standalone` adapter is a no-op (backend IS the system of record)
- Field mappings are JSON files in `mappings/` consumed by `field-mapper.ts`

To add a new ERP: create adapter in `adapters/`, add mapping JSON in `mappings/`, register in `adapter-factory.ts`.

### Sync Model

`SyncService` orchestrates bidirectional sync:
- **Pull**: fetches productos/clientes from ERP → upserts into local DB
- **Push**: finds pedidos/cobranzas with `syncStatus: 'pending'` → sends to ERP → updates status to `synced` or `error`

Cron jobs in `src/jobs/` run pull+push every 30 min for non-standalone tenants.

### Conventions

- API responses: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`
- Paginated responses add `pagination: { total, page, limit, totalPages }`
- Errors: throw custom classes from `utils/errors.ts` (AppError, NotFoundError, ValidationError, etc.) — caught by global `errorHandler`
- Env validation via Zod schema in `config/env.ts` — fails fast on invalid config
- TypeScript strict mode. Express 5 types (`@types/express@^5`) — `req.params` values are `string | string[]`, cast with `as string`
- All domain text (errors, field names) is in Spanish

## consideraciones
- Responde siempre en español
