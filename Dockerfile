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

# The data directory is owned by the unprivileged user so a fresh named volume inherits it
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "src/index.js"]
