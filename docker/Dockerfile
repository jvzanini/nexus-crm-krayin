FROM node:20-slim AS deps
WORKDIR /app
ARG NPM_TOKEN
COPY package.json package-lock.json .npmrc ./
COPY vendor-packages ./vendor-packages
COPY scripts ./scripts
RUN printf "//npm.pkg.github.com/:_authToken=%s\n" "${NPM_TOKEN}" >> .npmrc \
    && npm install --no-audit --no-fund --legacy-peer-deps --omit=dev \
    && rm -f .npmrc

FROM node:20-slim AS builder
WORKDIR /app
ARG NPM_TOKEN
COPY package.json package-lock.json .npmrc ./
COPY vendor-packages ./vendor-packages
COPY scripts ./scripts
RUN printf "//npm.pkg.github.com/:_authToken=%s\n" "${NPM_TOKEN}" >> .npmrc \
    && npm install --no-audit --no-fund --legacy-peer-deps \
    && rm -f .npmrc
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV REDIS_URL="redis://dummy:6379"
RUN npx prisma generate
RUN npm run build
# Queue pattern incluso — bundle do worker
RUN npx esbuild src/lib/worker/index.ts --bundle --platform=node --outfile=worker-bundle.js --external:bullmq --external:ioredis

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
# Queue pattern incluso — copiar worker bundle
COPY --from=builder /app/worker-bundle.js ./worker/index.js

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
