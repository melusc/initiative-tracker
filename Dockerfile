FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS builder

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

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runner-intermediate

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

RUN rm -r /root/.cache

COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/util/dist ./util/dist

RUN mkdir /app/data

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

FROM scratch

COPY --from=runner-intermediate / /

WORKDIR /app

ENV BIND_PORT=3000
ENV BIND_HOST=0.0.0.0
ENV NODE_ENV=production

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "/app/backend/dist/server.js"]
