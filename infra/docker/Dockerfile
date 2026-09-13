FROM node:24.8.0-bookworm-slim AS node-runtime
FROM python:3.14.6-slim-bookworm AS app
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && apt-get update && apt-get install -y --no-install-recommends g++ make ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml requirements.lock ./
RUN npm install --global pnpm@10.32.1 && pnpm install --frozen-lockfile
RUN python -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r requirements.lock
ARG BUILD_REVISION=development
ENV AGM_BUILD_REVISION=$BUILD_REVISION
COPY . .
ENV AGM_STATIC_EXPORT=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
RUN node scripts/sync-site.mjs && pnpm build
RUN useradd --create-home --uid 10001 agm && mkdir -p /app/data && chown -R agm:agm /app/data
USER agm
ENV NODE_ENV=production AGM_DATA_DIR=/app/data AGM_MCP_EXECUTABLE=/app/.venv/bin/bm AGM_FRONTEND_DIR=/app/apps/web/out
