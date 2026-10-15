# ---- Build the client ----
FROM node:22-alpine AS client
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    SEED_DIR=/app/seed \
    PUBLIC_DIR=/app/public
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY server/seed ./seed
COPY --from=client /build/dist ./public

# The app runs as the unprivileged node user. The entrypoint starts as root to give that user the
# data directory (bind-mounted host directories are created as root), then drops privileges.
RUN apk add --no-cache su-exec && mkdir -p /data && chown node:node /data
COPY --chmod=755 server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
