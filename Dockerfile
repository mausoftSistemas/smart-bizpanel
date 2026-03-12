FROM node:20-alpine AS builder

WORKDIR /app

# ─── Backend dependencies ─────────────────────
COPY package*.json ./
RUN npm ci

# ─── Frontend dependencies ────────────────────
COPY web/package*.json ./web/
RUN cd web && npm ci

# ─── Copy source ──────────────────────────────
COPY . .

# ─── Build backend ────────────────────────────
RUN npx prisma generate
RUN npm run build

# ─── Build frontend ───────────────────────────
RUN cd web && npm run build

# ═══════════════════════════════════════════════
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
