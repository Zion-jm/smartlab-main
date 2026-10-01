FROM node:22.13.0-bookworm-slim

# Chromium and fonts are runtime requirements for authenticated PDF exports.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global npm@10.9.2

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    PORT=10000
USER node
EXPOSE 10000
# Migrations and administrator initialization are explicit operator actions.
CMD ["node", "backend/scripts/start-production.cjs"]
