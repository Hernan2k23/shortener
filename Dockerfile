# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the app
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

COPY index.html ./index.html
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# tini gives us a proper signal handler so the consumer drains on SIGTERM
RUN apk add --no-cache tini

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/index.html ./index.html

USER app
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
