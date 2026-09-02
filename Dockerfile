# ============================================================================
#  Roadmap Hub — Vite + React SPA + small Express API
#  Two-stage build: node builds the bundle, a second node stage serves the
#  bundle + API as a single process.
# ============================================================================

# ---- Stage 1: build the Vite bundle ---------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# devDependencies (vite, @vitejs/plugin-react) MUST be installed for the
# build to run `vite build`. Do NOT add --omit=dev / --production here.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN test -f dist/index.html

# ---- Stage 2: serve the static bundle + API --------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8787/health || exit 1

CMD ["node", "server/index.mjs"]
