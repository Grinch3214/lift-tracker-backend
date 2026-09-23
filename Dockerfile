# syntax=docker/dockerfile:1

# ---- deps: все зависимости (включая dev — нужны для сборки TS) ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: компилируем TypeScript в dist/ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod-deps: только то, что нужно в рантайме (без typescript/@nestjs/cli и т.д.) ----
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: финальный образ, ничего лишнего ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Не root — не должно быть причин запускать процесс с правами суперпользователя внутри контейнера
RUN groupadd --system --gid 1001 nestjs \
  && useradd --system --uid 1001 --gid nestjs nestjs
USER nestjs

# Порт по умолчанию из .env/main.ts (process.env.PORT ?? 6600)
EXPOSE 6600

CMD ["node", "dist/main.js"]
