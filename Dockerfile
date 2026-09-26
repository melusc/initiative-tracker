FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS builder

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-*.yaml ./
COPY api/package.json ./api/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY util/package.json ./util/

# Cache pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
	CI=true pnpm install --frozen-lockfile

COPY . .

# Cache cargo registry and output
RUN --mount=type=cache,target=/usr/local/cargo/registry \
	--mount=type=cache,target=/app/target \
	pnpm build

FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
	libimage-exiftool-perl gosu \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-*.yaml /app/COPYING ./
COPY --from=builder /app/api/package.json ./api/
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/util/package.json ./util/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
	CI=true pnpm install --prod --frozen-lockfile

COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/util/dist ./util/dist

RUN mkdir /app/data

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV BIND_PORT=3000
ENV BIND_HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "/app/backend/dist/server.js"]
