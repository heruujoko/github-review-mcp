# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.18.0

FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV NODE_ENV=development
COPY tsconfig.json ./
COPY src ./src
COPY strategies ./strategies
RUN pnpm typecheck
RUN pnpm build

FROM base AS prod-deps
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS runtime
ENV PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/strategies ./strategies
COPY package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
