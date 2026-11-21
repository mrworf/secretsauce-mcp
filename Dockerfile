FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS base
RUN apk upgrade --no-cache

FROM base AS build-tools
RUN npm install --global npm@12.2.3 --ignore-scripts --no-audit

FROM build-tools AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM build-tools AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime
WORKDIR /app
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production
ENV CONFIG_PATH=/config/config.yaml
ENV SECRETLINT_CONFIG_PATH=/config/secretlint.yaml
ENV SENSITIVE_NAMES_CONFIG_PATH=/config/sensitive-names.yaml
ENV SECRETLINT_QUEUE_MAX=32
ENV SECRETLINT_SUBJECT_ACTIVE_MAX=1
ENV SECRETLINT_SUBJECT_QUEUE_MAX=4
ENV SECRETLINT_QUEUE_TIMEOUT_MS=5000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY assets/brand/secretsauce-icon.png ./assets/brand/secretsauce-icon.png
COPY assets/brand/secretsauce-lockup.png ./assets/brand/secretsauce-lockup.png
COPY config/secretlint.yaml /app/config/secretlint.yaml
COPY config/secretlint.yaml /config/secretlint.yaml
COPY config/sensitive-names.yaml /app/config/sensitive-names.yaml
COPY config/sensitive-names.yaml /config/sensitive-names.yaml
COPY package.json ./
COPY resources ./resources
COPY scripts/docker-entrypoint.sh scripts/docker-launcher.mjs ./scripts/
RUN chmod 0555 /app/scripts/docker-entrypoint.sh
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
